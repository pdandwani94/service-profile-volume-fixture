# Service Profile Volume Fixture

Synthetic public repository for volume and correctness testing of the Generate Service Profile skill.

The verified target is `profile-volume-target` under `services/target-service`. The repository deliberately contains:

- more than 20 relevant files;
- a directory with more than 50 entries;
- more than 20 search matches;
- a file larger than 64 KiB;
- two target-service tests that must be read before optional documentation;
- a current API contract plus a generated, deprecated contract;
- production feature flags backed by LaunchDarkly with deterministic local fallback;
- Prometheus metrics and Pino structured log events used by application code;
- a sibling service with similar terminology and forbidden facts;
- an unrelated PIR-like document under the sibling boundary.

`service-catalog.json` is the authoritative component-to-path relation. `GROUND_TRUTH.json` defines expected and forbidden profile evidence.

## Scan feature flags, metrics, and logs

The target service contains a realistic, runnable code-signal fixture:

- flag keys are defined in `src/feature-flags/flag-catalog.mjs` and evaluated by `OrderService`;
- metric names are defined in `src/observability/metric-catalog.mjs`, recorded with the official `@prometheus-io/client`, and exposed at `GET /metrics`;
- stable log events are defined in `src/observability/log-event-catalog.mjs` and emitted as structured Pino records.

Install the target dependencies and run the full repository check:

```bash
pnpm install --frozen-lockfile
pnpm check
```

Use `prompts/code-signals-target.txt` for a retrieval-only agent scan. Save its JSON response and validate the exact signal sets, providers, revision, and sibling boundary:

```bash
pnpm validate-signals -- /path/to/code-signals-output.json
```

No LaunchDarkly credential is required for local runs. The service uses checked-in boolean defaults unless `LAUNCHDARKLY_SDK_KEY` is set. `FEATURE_FLAG_OVERRIDES` accepts a JSON object for local behavior changes.

## Generate fixtures

```bash
npm run generate
npm run check
```

## Validate a generated profile

Save the complete skill response, including any code fence, then run:

```bash
npm run validate-profile -- /path/to/profile-output.txt
```

The validator rejects prose outside the JSON, missing mandatory evidence, sibling contamination, mutable GitHub citations for a SHA-pinned run, invalid word budgets, and incorrect placeholders.
