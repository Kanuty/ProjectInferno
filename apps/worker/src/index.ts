import { getClient, purgeUnactivatedAccounts } from "@project-inferno/database";
import { WorldMapConfig } from "@project-inferno/contracts";
import {
  calculateResources,
  selectPeriodicNeutralSpawnHex,
  DEFAULT_WORLD_MAP_CONFIG,
} from "@project-inferno/game-core";

const POLL_INTERVAL_MS = 2000;
let pollCounter = 0;

export async function processDueEvents() {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Claim due events safely using FOR UPDATE SKIP LOCKED
    const claimRes = await client.query(`
      SELECT id, world_id, event_type, payload, execute_at
      FROM game_events
      WHERE status = 'PENDING' AND execute_at <= CURRENT_TIMESTAMP
      ORDER BY execute_at ASC
      LIMIT 10
      FOR UPDATE SKIP LOCKED
    `);

    if (claimRes.rows.length === 0) {
      await client.query("COMMIT");
      return;
    }

    for (const event of claimRes.rows) {
      console.log(`[Worker] Processing event ${event.id} (${event.event_type}) for world ${event.world_id}`);

      try {
        if (event.event_type === "RESOURCE_UPDATE") {
          const { baseId } = event.payload;
          if (baseId) {
            const baseRes = await client.query(
              `SELECT id, resource_amount_at_ref, resource_production_rate, resource_ref_at, resource_capacity
               FROM player_bases WHERE id = $1 FOR UPDATE`,
              [baseId]
            );

            if (baseRes.rows.length > 0) {
              const base = baseRes.rows[0];
              const now = new Date();
              const updatedAmount = calculateResources({
                amountAtReference: Number(base.resource_amount_at_ref),
                productionRate: Number(base.resource_production_rate),
                referenceAt: new Date(base.resource_ref_at),
                effectiveTime: now,
                capacity: Number(base.resource_capacity),
              });

              await client.query(
                `UPDATE player_bases
                 SET resource_amount_at_ref = $1, resource_ref_at = $2
                 WHERE id = $3`,
                [updatedAmount, now, baseId]
              );
            }
          }
        } else if (event.event_type === "NEUTRAL_SPAWN_CYCLE") {
          const worldId = event.world_id;
          const cycleNumber = Number(event.payload.cycleNumber || 1);

          // Fetch world & map config
          const worldRes = await client.query(
            `SELECT id, starts_at, status, map_config FROM worlds WHERE id = $1`,
            [worldId]
          );

          if (worldRes.rows.length > 0) {
            const world = worldRes.rows[0];
            const mapConfig: WorldMapConfig = { ...DEFAULT_WORLD_MAP_CONFIG, ...world.map_config };

            // Record cycle idempotently in neutral_spawn_cycles table
            const cycleInsert = await client.query(
              `INSERT INTO neutral_spawn_cycles (world_id, cycle_number, scheduled_at, status)
               VALUES ($1, $2, $3, 'COMPLETED')
               ON CONFLICT (world_id, cycle_number) DO NOTHING
               RETURNING id`,
              [worldId, cycleNumber, event.execute_at]
            );

            // If cycle hasn't been executed yet, run spawning logic per eligible player
            if (cycleInsert.rows.length > 0) {
              // Get all distinct players who own at least 1 base
              const playerUsersRes = await client.query(
                `SELECT DISTINCT user_id FROM player_bases WHERE world_id = $1 AND user_id IS NOT NULL`,
                [worldId]
              );

              // Get all occupied hexes
              const allBasesRes = await client.query(
                `SELECT q, r, user_id FROM player_bases WHERE world_id = $1`,
                [worldId]
              );

              const occupiedHexes = new Set<string>();
              for (const b of allBasesRes.rows) {
                occupiedHexes.add(`${b.q},${b.r}`);
              }

              for (const playerRow of playerUsersRes.rows) {
                const userId = playerRow.user_id;
                const playerBases = allBasesRes.rows.filter((b) => b.user_id === userId);

                const chosenHex = selectPeriodicNeutralSpawnHex(mapConfig, playerBases, occupiedHexes);
                if (chosenHex) {
                  await client.query(
                    `INSERT INTO player_bases (world_id, user_id, name, q, r, position_x, position_y, neutral_origin, points)
                     VALUES ($1, NULL, 'Abandoned Village', $2, $3, $2, $3, 'GENERATED_PERIODIC', 100)
                     ON CONFLICT (world_id, q, r) DO NOTHING`,
                    [worldId, chosenHex.q, chosenHex.r]
                  );
                  occupiedHexes.add(`${chosenHex.q},${chosenHex.r}`);
                }
              }

              // Schedule next cycle if within cutoff period Y
              const startsAtTime = world.starts_at ? new Date(world.starts_at).getTime() : new Date().getTime();
              const cutoffTime = startsAtTime + mapConfig.periodicSpawnCutoffDays * 86400 * 1000;
              const nextExecuteAtTime = new Date(event.execute_at).getTime() + mapConfig.periodicSpawnIntervalDays * 86400 * 1000;

              if (nextExecuteAtTime <= cutoffTime) {
                await client.query(
                  `INSERT INTO game_events (world_id, event_type, execute_at, payload, status)
                   VALUES ($1, 'NEUTRAL_SPAWN_CYCLE', $2, $3, 'PENDING')`,
                  [worldId, new Date(nextExecuteAtTime), JSON.stringify({ worldId, cycleNumber: cycleNumber + 1 })]
                );
              }
            }
          }
        }

        // Mark event COMPLETED
        await client.query(`UPDATE game_events SET status = 'COMPLETED' WHERE id = $1`, [event.id]);
      } catch (handlerErr: any) {
        console.error(`[Worker] Failed processing event ${event.id}:`, handlerErr);
        await client.query(`UPDATE game_events SET status = 'FAILED', retry_count = retry_count + 1 WHERE id = $1`, [
          event.id,
        ]);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Worker] Event loop transaction error:", err);
  } finally {
    client.release();
  }
}

let isRunning = true;

export async function processWorldLifecycleTransitions() {
  const client = await getClient();
  try {
    const activateRes = await client.query(`
      UPDATE worlds
      SET status = 'active',
          auto_close_at = NOW() + (auto_close_days || '20')::TEXT::INTERVAL
      WHERE (status = 'planned_open' OR status = 'planned_closed')
        AND starts_at IS NOT NULL AND starts_at <= NOW()
      RETURNING id, name
    `);

    for (const w of activateRes.rows) {
      console.log(`[Worker] Scheduled world '${w.name}' (${w.id}) start time reached -> Transitioned to 'active' status.`);
    }

    const autoCloseRes = await client.query(`
      UPDATE worlds
      SET status = 'active_closed'
      WHERE status = 'active'
        AND auto_close_at IS NOT NULL AND auto_close_at <= NOW()
      RETURNING id, name
    `);

    for (const w of autoCloseRes.rows) {
      console.log(`[Worker] Active world '${w.name}' (${w.id}) duration timer elapsed -> Transitioned to 'active_closed' status.`);
    }
  } catch (err: any) {
    console.error("[Worker] World lifecycle transition check failed:", err.message || err);
  } finally {
    client.release();
  }
}

export async function startWorker() {
  console.log("[Worker] Background event worker started.");
  while (isRunning) {
    try {
      await processDueEvents();
      pollCounter++;
      if (pollCounter % 15 === 0) {
        await purgeUnactivatedAccounts();
        await processWorldLifecycleTransitions();
      }
    } catch (err: any) {
      console.error("[Worker] Polling loop error:", err.message || err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

if (process.env.NODE_ENV !== "test") {
  startWorker();
}
