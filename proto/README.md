# In-Repo Proto Sources

This directory contains `.proto` source files that override the pip-installed `sentry-protos` package at import time. Proto files placed here are automatically detected by `proto_loader` and compiled on demand during development, or pre-compiled during CI/deploy for production.

## Directory Structure

Proto files must follow the `sentry-protos` package convention:

```
proto/
  sentry_protos/
    billing/
      v1/
        data_category.proto
        date.proto
        usage_data.proto
        services/
          usage/
            v1/
              endpoint_usage.proto
```

## Usage

Once proto files are here, they just work -- no configuration needed:

```python
from sentry_protos.billing.v1.data_category_pb2 import DataCategory
```

## Priority Order

1. **This directory** (`proto/`) -- highest priority, committed to git
2. **`SENTRY_PROTO_DEV_DIR`** env var -- for iterating on protos before committing
3. **pip-installed `sentry-protos`** -- fallback for protos not overridden locally

## Syncing from sentry-protos

To copy billing protos from a local sentry-protos checkout:

```bash
bin/sync-protos /path/to/sentry-protos billing
```

See `src/sentry/utils/PROTO_OVERRIDE.md` for full documentation.
