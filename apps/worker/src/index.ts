import { getClient } from "@project-inferno/database";
import { calculateResources } from "@project-inferno/game-core";

const POLL_INTERVAL_MS = 2000;

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

export async function startWorker() {
  console.log("[Worker] Background event worker started.");
  while (isRunning) {
    try {
      await processDueEvents();
    } catch (err) {
      console.error("[Worker] Polling loop error:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

if (process.env.NODE_ENV !== "test") {
  startWorker();
}
