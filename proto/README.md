# Proto Sources

This directory holds `.proto` files that override the pip-installed `sentry-protos` package. Proto files here are compiled on demand during development and pre-compiled during CI/deploy for production.

This is a temporary mechanism for faster iteration on proto definitions without waiting for a `sentry-protos` release. Changes here should eventually be published back to `sentry-protos`.

## Directory Structure

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

Once proto files are here, they just work:

```python
from sentry_protos.billing.v1.data_category_pb2 import DataCategory
```

## Editing Protos

Edit `.proto` files in this directory directly. On next import, the `proto_loader` detects the change (via mtime) and recompiles automatically. No restart needed unless the module was already imported in the current process.

## How Overrides Work

1. **This directory** (`proto/`) -- highest priority
2. **pip-installed `sentry-protos`** -- fallback

See `src/sentry/utils/PROTO_OVERRIDE.md` for full documentation.

## Copying Protos from sentry-protos

```bash
bin/sync-protos /path/to/sentry-protos billing
```
