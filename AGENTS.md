# PROJECT INFERNO - MANDATORY AGENT RULES

1. Read architecture documents and relevant ADRs in `Documentation/` before editing.
2. Treat PostgreSQL as the authoritative durable state.
3. Never use in-memory timers for durable gameplay scheduling.
4. Use `packages/contracts` as the single API transport contract source.
5. Web calls API through `packages/api-client`.
6. Keep `game-core` deterministic and infrastructure-free.
7. API and Worker reuse `game-core`; never duplicate game rules.
8. Persistent multi-write operations require explicit transactions.
9. Game Event handlers must be retry-safe/idempotent.
10. Redis contains only disposable/reconstructable state.
11. Every World-scoped operation validates `worldId`.
12. Schema changes require migrations and index review.
13. Do not introduce theme-specific names into generic modules.
14. Do not introduce new infrastructure without an ADR.
15. Before completion run lint, typecheck, unit tests, integration tests, relevant E2E tests, and build affected applications.
