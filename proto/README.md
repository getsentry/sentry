# Proto Sources

This directory is the **source of truth** for proto definitions used by sentry. Proto files here are compiled on demand during development and pre-compiled during CI/deploy for production.

Currently migrated domains:

- `billing/` — billing service protos (data categories, usage, contracts, etc.)

Other domains (snuba, seer, taskbroker, etc.) remain in the `sentry-protos` pip package until migrated.

## Directory Structure

```
proto/
  sentry_protos/
    billing/
      v1/
        data_category.proto
        date.proto
        usage_data.proto
        common/
          v1/
            address.proto
            ...
        services/
          usage/
            v1/
              endpoint_usage.proto
          contract/
            v1/
              ...
```

## Usage

Once proto files are here, they just work:

```python
from sentry_protos.billing.v1.data_category_pb2 import DataCategory
```

## Editing Protos

Edit `.proto` files in this directory directly. On next import, the `proto_loader` detects the change (via mtime) and recompiles automatically. No restart needed unless the module was already imported in the current process.

## How Overrides Work

1. **This directory** (`proto/`) -- highest priority
2. **pip-installed `sentry-protos`** -- fallback for non-migrated domains

See `src/sentry/utils/PROTO_OVERRIDE.md` for full documentation.

## Initial Migration

To migrate a new domain from `sentry-protos` into this repo:

```bash
bin/sync-protos /path/to/sentry-protos <domain>
```

After the initial copy, maintain the protos here -- do not re-sync.
