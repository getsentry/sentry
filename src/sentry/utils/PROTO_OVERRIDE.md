# Proto Override System

Compile and serve proto definitions directly from the sentry repo, replacing the pip-installed `sentry-protos` package for migrated domains.

## Why This Exists

Proto definitions used to live exclusively in the `sentry-protos` repo, with a separate pip release cycle. Iterating on protos required publishing a new `sentry-protos` version before sentry could use the changes. This system moves proto source files into the sentry repo itself (`proto/`), compiling them at import time during development and pre-compiling them during CI/deploy for production.

Domains are migrated incrementally. Non-migrated domains (snuba, seer, etc.) continue to be served from the `sentry-protos` pip package as a transparent fallback.

## Architecture

```
              proto/sentry_protos/          .proto source files (in git)
                        │
                        ▼
              proto_compiler.py             compiles .proto → _pb2.py
                        │
                        ▼
              .proto_cache/                 compiled _pb2.py files
                        │
                        ▼
              proto_loader.py               import hook, serves overrides
                        │                   falls back to pip
                        ▼
              from sentry_protos.X import Y_pb2
```

**proto_compiler.py** — compiles `.proto` files into `_pb2.py` modules. Used as a CLI for production builds or called on demand by the loader during development. Requires `grpcio-tools` but only imports it lazily.

**proto_loader.py** — lightweight import hook. Intercepts `sentry_protos` imports and serves compiled overrides from `.proto_cache/`, falling back to pip for anything not overridden. In dev mode, triggers compilation automatically when sources change.

## Quick Start

### Day-to-Day Development

Proto source files live in `proto/sentry_protos/` and are edited directly in the sentry repo. Call `install()` early in app startup:

```python
from sentry.utils.proto_loader import install
install()
```

Then import as usual:

```python
from sentry_protos.billing.v1.data_category_pb2 import DataCategory
```

When you edit a `.proto` file, the loader detects the mtime change and recompiles automatically on next import. No restart needed (unless the module was already loaded in the current process).

### CI

The `setup-sentry` GitHub Action pre-compiles protos after `fast_editable` and before tests. This avoids xdist workers racing to compile the same files at import time. The step is conditional on `proto/sentry_protos/` existing.

### Production

Pre-compilation happens in the **getsentry Dockerfile** (`js-builder` stage), not in this repo. The build step installs `grpcio-tools`, compiles protos from `proto/` into `.proto_cache/`, then removes `grpcio-tools`. The final image only contains pre-compiled `_pb2.py` files — no compiler toolchain.

At runtime, `install()` (called in `runner/initializer.py` before `django.setup()`) serves the pre-compiled files from `.proto_cache/`. No compilation happens at runtime.

### Existing imports don't change

The override is transparent. Existing code continues to use the same imports:

```python
from sentry_protos.billing.v1.data_category_pb2 import DataCategory
```

This works regardless of whether the module comes from `proto/` (override) or the pip-installed `sentry-protos` (fallback). No import changes, no conditional logic, no code migration needed.

### Priority Order

```
1. proto/            (in-repo, committed to git)        ← source of truth
2. pip sentry-protos (installed package)                 ← fallback for non-migrated domains
```

Migrated domains (e.g., billing) are maintained in `proto/`. Non-migrated domains (snuba, seer, etc.) are served from the pip-installed `sentry-protos` package until they are migrated.

### getsentry

No setup required. Both repos share one venv with sentry editable-installed, so `REPO_ROOT` in `proto_loader.py` resolves to sentry's repo root where `proto/` lives. The `install()` calls in sentry's initializer and pytest plugin cover getsentry automatically — both at runtime and in tests.

Proto overrides placed in sentry's `proto/sentry_protos/` are picked up by getsentry with no getsentry-side changes.

### Migrating a New Domain

To migrate a domain from `sentry-protos` into this repo (one-time):

```bash
bin/sync-protos /path/to/sentry-protos <domain>
```

After the initial copy, maintain the protos in `proto/` — do not re-sync.

## Configuration

Most setups need no environment variables — `proto/` and `.proto_cache/` work by convention.

| Environment Variable        | Purpose                                                          | Default                    |
| --------------------------- | ---------------------------------------------------------------- | -------------------------- |
| `SENTRY_PROTO_OVERRIDE_DIR` | Directory with pre-compiled `_pb2.py` files                      | `{repo_root}/.proto_cache` |
| `SENTRY_PROTO_DEV_DIR`      | Additional `.proto` source directory (rarely needed — see below) | _(none)_                   |

`{repo_root}/proto/` is the primary proto source directory. It is always checked first.

`SENTRY_PROTO_DEV_DIR` is available for edge cases like testing proto changes from an external checkout without modifying the repo. In normal development, edit protos in `proto/` directly.

## How It Works

The loader installs a Python import hook that intercepts `sentry_protos.*_pb2` imports. When a `_pb2` module is imported, the hook checks for a compiled override in `.proto_cache/`. If found (and up to date), it serves the override. Otherwise it falls back to the pip-installed version.

In dev mode, if a `.proto` source file is newer than the cached output, the hook compiles it automatically before serving.

Intermediate packages (like `sentry_protos.billing.v1`) are always loaded from pip — the hook only overrides the leaf `_pb2` modules. This means you can override individual protos without affecting the rest of the package.

New domains that don't exist in pip at all (e.g., a brand-new `sentry_protos.my_new_service`) are handled automatically — the loader creates the necessary intermediate packages in the cache directory.

## Directory Structure

```
proto/                              ← .proto sources (in git)
  sentry_protos/
    billing/
      v1/
        data_category.proto
        date.proto
        services/
          usage/
            v1/
              endpoint_usage.proto

.proto_cache/                       ← compiled output (gitignored)
  sentry_protos/
    billing/
      v1/
        data_category_pb2.py
        date_pb2.py
        services/
          usage/
            v1/
              endpoint_usage_pb2.py
```

## Helper Script: `bin/sync-protos`

A one-time migration tool for copying proto files from a `sentry-protos` checkout into `proto/`. After the initial migration, protos are maintained directly in the sentry repo.

```bash
# One-time migration: copy billing protos from sentry-protos
bin/sync-protos /path/to/sentry-protos billing

# Migrate multiple domains at once
bin/sync-protos /path/to/sentry-protos billing snuba

# Migrate all domains
bin/sync-protos --all

# Show current override status
bin/sync-protos --status

# Compile after migration (optional — loader auto-compiles in dev)
bin/sync-protos --compile

# Clear compiled cache
bin/sync-protos --clear
```

Defaults to `../sentry-protos` as the source and `billing` as the domain.

## CLI Reference

### Compile

```bash
# Compile all protos from one source directory
python -m sentry.utils.proto_compiler compile \
    --source /path/to/protos \
    --output .proto_cache

# Multiple source directories
python -m sentry.utils.proto_compiler compile \
    --source /path/to/sentry-protos/proto \
    --source /path/to/local/proto \
    --output .proto_cache

# Force recompile (ignore mtime cache)
python -m sentry.utils.proto_compiler compile \
    --source /path/to/protos \
    --output .proto_cache \
    --force
```

### Clear Cache

```bash
python -m sentry.utils.proto_compiler clear --output .proto_cache
```

## API Reference

### proto_compiler

| Function                                            | Description                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `compile_proto(proto_path, proto_dirs, output_dir)` | Compile a single `.proto` file. Returns `True` on success.         |
| `compile_all(proto_dirs, output_dir, force=False)`  | Compile all `.proto` files. Returns `(compiled, skipped, failed)`. |
| `find_proto_file(module_name, proto_dirs)`          | Map `sentry_protos.X.Y.Z_pb2` to its `.proto` source path.         |
| `needs_recompile(proto_path, cached_path)`          | Check if cache is stale (mtime comparison).                        |
| `clear_cache(cache_dir)`                            | Delete the entire cache directory.                                 |
| `compile_lock`                                      | `threading.RLock` for thread-safe compilation.                     |

### proto_loader

| Function        | Description                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `install()`     | Install the import hook. Returns `True` if installed, `False` if no sources configured. Idempotent. |
| `clear_cache()` | Delete the override directory contents.                                                             |

## Supported Import Patterns

All standard Python import patterns work:

```python
# Direct module import
from sentry_protos.billing.v1 import data_category_pb2
msg = data_category_pb2.DataCategory()

# Import specific symbols
from sentry_protos.billing.v1.data_category_pb2 import DataCategory
msg = DataCategory()

# Full module path
import sentry_protos.billing.v1.data_category_pb2 as dc_pb2
msg = dc_pb2.DataCategory()
```

## Troubleshooting

### "ModuleNotFoundError: No module named 'sentry_protos.X'"

- The loader isn't installed. Call `install()` before the import.
- If X is a new domain, check the directory structure: `proto/sentry_protos/X/v1/foo.proto`.

### "ImportError: grpcio-tools is required"

Install it: `pip install grpcio-tools`. In production, pre-compile during the build step so `grpcio-tools` isn't needed at runtime.

### Proto changes aren't picked up

- The loader checks mtime on every import. If nothing changed, touch the file: `touch proto/sentry_protos/.../foo.proto`.
- If the module was already imported in this process, restart or `importlib.reload()`.
- In prod, re-run: `python -m sentry.utils.proto_compiler compile --source proto --output .proto_cache --force`.

### "Proto file is not under any include path"

The `--source` flag should point to `proto/` (the directory containing `sentry_protos/`), not to `proto/sentry_protos/` itself.
