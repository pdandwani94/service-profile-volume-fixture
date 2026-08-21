# Service Profile Volume Fixture

Synthetic public repository for volume and correctness testing of the Generate Service Profile skill.

The verified target is `profile-volume-target` under `services/target-service`. The repository deliberately contains:

- more than 20 relevant files;
- a directory with more than 50 entries;
- more than 20 search matches;
- a file larger than 64 KiB;
- two target-service tests that must be read before optional documentation;
- a current API contract plus a generated, deprecated contract;
- a sibling service with similar terminology and forbidden facts;
- an unrelated PIR-like document under the sibling boundary.

`service-catalog.json` is the authoritative component-to-path relation. `GROUND_TRUTH.json` defines expected and forbidden profile evidence.

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
