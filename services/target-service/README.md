# Profile Volume Target

`profile-volume-target` is the only target service for the volume fixture. It is a reference implementation that accepts bounded batches of synthetic orders and stores them in memory.

Current runtime entrypoint: `src/server.mjs`.

Current API contract: `openapi/current.yaml`.

The file `openapi/deprecated-generated.yaml` is generated and deprecated. It must never be described as the current API.

The sibling service is outside this service boundary even when its files use similar payment and volume terminology.
