# Profile Volume Target

`profile-volume-target` is the only target service for the volume fixture. It is a reference implementation that accepts bounded batches of synthetic orders and stores them in memory.

Current runtime entrypoint: `src/server.mjs`.

Current API contract: `openapi/current.yaml`.

## Runtime integrations

The service uses provider adapters in production code:

- LaunchDarkly server-side Node SDK for boolean feature flags;
- `@prometheus-io/client` for Prometheus counters and histograms at `GET /metrics`;
- Pino for newline-delimited structured JSON logs.

`OrderService` evaluates three flags for each batch. They control duplicate-ID rejection, reference notifications, and audit logging. Provider initialization falls back to local defaults if `LAUNCHDARKLY_SDK_KEY` is absent or LaunchDarkly cannot initialize within `FEATURE_FLAG_INIT_TIMEOUT_SECONDS`.

Local overrides are explicit JSON booleans:

```bash
export FEATURE_FLAG_OVERRIDES='{"volume-orders.send-reference-notifications":true}'
pnpm --filter profile-volume-target start
```

Signal names live in the feature-flag, metric, and log-event catalog modules. `GROUND_TRUTH.json` records the exact expected lists and production usage paths so retrieval tests can distinguish declared signals from signals used by application code.

The file `openapi/deprecated-generated.yaml` is generated and deprecated. It must never be described as the current API.

The sibling service is outside this service boundary even when its files use similar payment and volume terminology.
