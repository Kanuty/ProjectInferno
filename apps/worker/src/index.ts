import { getClient, purgeUnactivatedAccounts } from "@project-inferno/database";
import { calculateResources } from "@project-inferno/game-core";

const POLL_INTERVAL_MS = 2000;
let pollCounter = 0;

export async function processDueEvents() {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Claim due events safely using FOR UPDATE SKIP LOCKED
    const claimRes = await client.query(`
      SELECT id, world_id, event_type, payload
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
        // Execute event logic using deterministic rules from game-core
        if (event.event_type === "RESOURCE_UPDATE") {
          const { baseId, targetResource } = event.payload;
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
                capacity: Number(base.resource_capacity)
              });

              await client.query(
                `UPDATE player_bases
                 SET resource_amount_at_ref = $1, resource_ref_at = $2
                 WHERE id = $3`,
                [updatedAmount, now, baseId]
              );
            }
          }
        }

        // Mark event COMPLETED
        await client.query(
          `UPDATE game_events SET status = 'COMPLETED' WHERE id = $1`,
          [event.id]
        );
      } catch (handlerErr: any) {
        console.error(`[Worker] Failed processing event ${event.id}:`, handlerErr);
        await client.query(
          `UPDATE game_events SET status = 'FAILED', retry_count = retry_count + 1 WHERE id = $1`,
          [event.id]
        );
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
    // 1. Activate scheduled worlds whose start time has arrived
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

    // 2. Automatically transition active worlds to 'active_closed' when auto_close_at duration timer elapses
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
      // Run account cleanup and world lifecycle checks every 15 polling ticks (~30 seconds)
      if (pollCounter % 15 === 0) {
        await purgeUnactivatedAccounts();
        await processWorldLifecycleTransitions();
      }
    } catch (err: any) {
      console.error("[Worker] Polling loop error (Database may be unreachable):", err.message || err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

if (process.env.NODE_ENV !== "test") {
  startWorker();
}
