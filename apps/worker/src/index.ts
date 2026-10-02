import { getClient, purgeUnactivatedAccounts, runMigrations } from "@project-inferno/database";
import { WorldMapConfig, BuildingTypeId, ResourceType, ResourceStorageDto } from "@project-inferno/contracts";
import {
  calculateResources,
  selectPeriodicNeutralSpawnHex,
  DEFAULT_WORLD_MAP_CONFIG,
  NEUTRAL_RACE_ID,
  getInitialBaseBuildings,
  getInitialResourceStorages,
  calculateBaseResources,
  CANONICAL_BUILDING_IDS,
  ALL_RESOURCE_TYPES,
} from "@project-inferno/game-core";

async function ensureWorkerBaseInitialData(client: any, baseId: string, tintRaceId?: string | null): Promise<void> {
  const buildCheck = await client.query(
    `SELECT COUNT(*)::int as count FROM base_buildings WHERE base_id = $1`,
    [baseId]
  );
  if (buildCheck.rows[0].count === 0) {
    const initialBuildings = getInitialBaseBuildings();
    for (const bType of CANONICAL_BUILDING_IDS) {
      await client.query(
        `INSERT INTO base_buildings (base_id, building_type, level)
         VALUES ($1, $2, $3)
         ON CONFLICT (base_id, building_type) DO NOTHING`,
        [baseId, bType, initialBuildings[bType] || 0]
      );
    }
  }

  const resCheck = await client.query(
    `SELECT COUNT(*)::int as count FROM base_resources WHERE base_id = $1`,
    [baseId]
  );
  if (resCheck.rows[0].count === 0) {
    const initialResources = getInitialResourceStorages(0, 100);
    const nowIso = new Date().toISOString();
    for (const rType of ALL_RESOURCE_TYPES) {
      const rStorage = initialResources[rType];
      await client.query(
        `INSERT INTO base_resources (base_id, resource_type, amount, production_rate, capacity, ref_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (base_id, resource_type) DO NOTHING`,
        [baseId, rType, rStorage.amount, rStorage.productionRate, rStorage.capacity, nowIso]
      );
    }
  }
}

async function updateWorkerVillageResources(client: any, baseId: string, effectiveTime: Date = new Date()): Promise<void> {
  const baseRes = await client.query(`SELECT tint_race_id FROM player_bases WHERE id = $1`, [baseId]);
  const tintRaceId = baseRes.rows[0]?.tint_race_id || null;

  await ensureWorkerBaseInitialData(client, baseId, tintRaceId);

  const bRes = await client.query(
    `SELECT building_type as "buildingType", level FROM base_buildings WHERE base_id = $1`,
    [baseId]
  );
  const buildingsMap = {} as Record<BuildingTypeId, number>;
  for (const bId of CANONICAL_BUILDING_IDS) {
    buildingsMap[bId] = 0;
  }
  for (const row of bRes.rows) {
    if (row.buildingType in buildingsMap) {
      buildingsMap[row.buildingType as BuildingTypeId] = Number(row.level);
    }
  }

  const rRes = await client.query(
    `SELECT resource_type as "resourceType", amount, production_rate as "productionRate", capacity, ref_at as "referenceAt"
     FROM base_resources WHERE base_id = $1`,
    [baseId]
  );
  const currentStorages: Partial<Record<ResourceType, ResourceStorageDto>> = {};
  for (const row of rRes.rows) {
    currentStorages[row.resourceType as ResourceType] = {
      resourceType: row.resourceType,
      amount: Number(row.amount),
      productionRate: Number(row.productionRate),
      capacity: Number(row.capacity),
      referenceAt: new Date(row.referenceAt).toISOString(),
    };
  }

  const updatedStorages = calculateBaseResources({
    buildings: buildingsMap,
    tintRaceId,
    currentStorages,
    effectiveTime,
  });

  const effIso = effectiveTime.toISOString();
  for (const rType of ALL_RESOURCE_TYPES) {
    const s = updatedStorages[rType];
    await client.query(
      `INSERT INTO base_resources (base_id, resource_type, amount, production_rate, capacity, ref_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (base_id, resource_type) DO UPDATE SET
         amount = EXCLUDED.amount,
         production_rate = EXCLUDED.production_rate,
         capacity = EXCLUDED.capacity,
         ref_at = EXCLUDED.ref_at`,
      [baseId, rType, s.amount, s.productionRate, s.capacity, effIso]
    );
  }

  const matStorage = updatedStorages["BUILDING_MATERIAL"];
  if (matStorage) {
    await client.query(
      `UPDATE player_bases
       SET resource_amount_at_ref = $1, resource_production_rate = $2, resource_capacity = $3, resource_ref_at = $4
       WHERE id = $5`,
      [matStorage.amount, matStorage.productionRate, matStorage.capacity, effIso, baseId]
    );
  }
}

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

      await client.query("SAVEPOINT event_sp");
      try {
        if (event.event_type === "RESOURCE_UPDATE") {
          const { baseId } = event.payload;
          if (baseId) {
            await updateWorkerVillageResources(client, baseId, new Date());
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
                  const pRes = await client.query(
                    `INSERT INTO player_bases (world_id, user_id, name, q, r, position_x, position_y, tint_race_id, neutral_origin, points)
                     VALUES ($1, NULL, 'Abandoned Village', $2, $3, $2, $3, $4, 'GENERATED_PERIODIC', 100)
                     ON CONFLICT (world_id, q, r) DO NOTHING
                     RETURNING id`,
                    [worldId, chosenHex.q, chosenHex.r, NEUTRAL_RACE_ID]
                  );
                  if (pRes.rows.length > 0) {
                    await ensureWorkerBaseInitialData(client, pRes.rows[0].id, NEUTRAL_RACE_ID);
                  }
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

        await client.query("RELEASE SAVEPOINT event_sp");
        // Mark event COMPLETED
        await client.query(`UPDATE game_events SET status = 'COMPLETED' WHERE id = $1`, [event.id]);
      } catch (handlerErr: any) {
        await client.query("ROLLBACK TO SAVEPOINT event_sp");
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
  if (process.env.AUTO_MIGRATE !== "false") {
    try {
      await runMigrations();
    } catch (err: any) {
      console.warn("[Worker] Startup database migration skipped or failed:", err.message || err);
    }
  }
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
