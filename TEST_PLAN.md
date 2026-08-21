# Volume Test Plan

## Target

- Service: `profile-volume-target`
- Repository: `https://github.com/pdandwani94/service-profile-volume-fixture`
- Verified service path: `services/target-service`
- Component relation: `service-catalog.json`

Always record the repository commit SHA used by a run.

## Stage 1: smoke

Run the prompt in `prompts/profile-volume-target.txt` once through a test Agent Studio agent containing Generate Service Profile.

Save the complete response and validate it:

```bash
npm run validate-profile -- profiles/smoke-001.txt
```

Do not continue to repeated or concurrent runs until the smoke response passes.

## Stage 2: repeatability

Run the same pinned prompt ten times sequentially. Every response must pass the validator. Compare facts and gaps, not prose identity.

Required invariants:

- exactly one JSON object and no prose outside it;
- the target boundary remains `services/target-service`;
- both mandatory tests are inspected before optional documents;
- the current contract is `openapi/current.yaml`;
- the generated deprecated contract stays qualified;
- sibling facts do not enter target-service fields;
- oversized and truncated-directory gaps are recorded;
- all GitHub citations are commit pinned when `pinning=sha`.

## Stage 3: concurrency

Invoke the test agent through its approved API trigger at concurrency 1, 5, and 10. Run ten requests per level. Capture the full response and tool trace for each request.

For every run capture:

- run ID, agent version, skill version, model, repository SHA;
- start time, end time, and terminal status;
- ordered tool calls and returned result counts;
- raw files read and per-file bytes;
- directory/search call count;
- total raw bytes, provider payload bytes, and normalized evidence bytes;
- rate limits, retries, timeouts, and partial responses;
- validator result.

Stop increasing concurrency if any run violates an evidence cap, returns partial JSON, contaminates the target with sibling facts, or receives an unrecovered provider error.

## Stage 4: soak

After concurrency 5 is clean, run two requests per minute for one hour. Use a staging agent and repository read-only tools. Do not run a soak from manual Rovo Chat.

## Pass criteria

- JSON-only validity: 100%
- Target-boundary contamination: 0
- Evidence-budget violations: 0
- SHA pinning when supported: 100%
- Mandatory-category priority violations: 0
- Unsupported current-runtime claims: 0
- Unrecovered provider failures: 0
- All responses pass `scripts/validate-profile.mjs`

Agent Studio evaluation datasets cover scenario correctness. API-triggered runs cover concurrency, rate limits, and sustained load. Neither substitutes for the other.
