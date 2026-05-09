# Proto Override System

Compile and serve proto definitions directly from the sentry repo, replacing the pip-installed `sentry-protos` package for migrated domains.

## Why This Exists

Proto definitions used to live exclusively in the `sentry-protos` repo, with a separate pip release cycle. Iterating on protos required publishing a new `sentry-protos` version before sentry could use the changes. This system moves proto source files into the sentry repo itself (`proto/`), compiling them at import time during development and pre-compiling them during CI/deploy for production.

Domains are migrated incrementally. Non-migrated domains (snuba, seer, etc.) continue to be served from the `sentry-protos` pip package as a transparent fallback.

## Architecture

The system is split into two modules with distinct responsibilities:

```
                          ┌─────────────────────┐
                          │   .proto sources     │
                          │ (sentry-protos repo  │
                          │  or local proto/)    │
                          └─────────┬───────────┘
                                    │
              ┌─────────────────────▼───────────────────────┐
              │           proto_compiler.py                  │
              │  Build-time tool (requires grpcio-tools)     │
              │                                              │
              │  compile_proto()  – single file              │
              │  compile_all()   – batch compilation         │
              │  CLI: python -m sentry.utils.proto_compiler  │
              └─────────────────────┬───────────────────────┘
                                    │ writes _pb2.py files
                                    ▼
                          ┌─────────────────────┐
                          │   .proto_cache/      │
                          │ (override directory) │
                          └─────────┬───────────┘
                                    │ served by
              ┌─────────────────────▼───────────────────────┐
              │            proto_loader.py                   │
              │  Runtime import hook (lightweight, no        │
              │  grpcio-tools dependency in prod mode)       │
              │                                              │
              │  MetaPathFinder at sys.meta_path[0]          │
              │  Intercepts sentry_protos.*_pb2 imports      │
              │  Falls back to pip for everything else       │
              └─────────────────────────────────────────────┘
```

**proto_compiler.py** handles compilation only. It requires `grpcio-tools` but only imports it lazily, so the module can be imported safely even when `grpcio-tools` isn't installed.

**proto_loader.py** handles import-time resolution only. In development mode it calls the compiler on demand; in production mode it serves pre-compiled files with zero extra dependencies.

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

### Production

Compile during your build/deploy step:

```bash
python -m sentry.utils.proto_compiler compile \
    --source proto \
    --output .proto_cache
```

Call `install()` in app startup. The loader serves pre-compiled files with no compilation at runtime — `grpcio-tools` is not required in the production image.

### Priority Order

```
1. proto/            (in-repo, committed to git)        ← source of truth
2. pip sentry-protos (installed package)                 ← fallback for non-migrated domains
```

Migrated domains (e.g., billing) are maintained in `proto/`. Non-migrated domains (snuba, seer, etc.) are served from the pip-installed `sentry-protos` package until they are migrated.

### getsentry Integration

Since `proto_loader.py` lives in the sentry package, `REPO_ROOT` resolves to sentry's root — meaning getsentry automatically picks up sentry's `proto/` directory when it imports the loader:

```python
# In getsentry's startup or conftest:
from sentry.utils.proto_loader import install
install()
# → Finds sentry/proto/ as LOCAL_PROTO_DIR automatically
```

For production getsentry deployments, compile protos during the build step:

```bash
python -m sentry.utils.proto_compiler compile \
    --source /path/to/sentry/proto \
    --output .proto_cache
```

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

## How the Import Hook Works

### Import Resolution Flow

When Python encounters `from sentry_protos.billing.v1 import data_category_pb2`:

```
1. Python imports sentry_protos
   └─ Our finder: not "sentry_protos." (no dot suffix) → returns None
   └─ Pip's finder: loads the pip-installed package ✓

2. Python imports sentry_protos.billing
   └─ Our finder: intermediate package, pip has it → returns None
   └─ Pip's finder: loads from pip with correct __path__ ✓

3. Python imports sentry_protos.billing.v1
   └─ Our finder: intermediate package, pip has it → returns None
   └─ Pip's finder: loads from pip ✓

4. Python imports sentry_protos.billing.v1.data_category_pb2
   └─ Our finder: _pb2 module! Check override dir...
      ├─ Found in cache (and up to date) → return spec from cache ✓
      ├─ Source newer than cache (dev mode) → compile, return spec ✓
      └─ Not in cache → return None, pip's version is used ✓
```

The critical insight: **MetaPathFinders are always consulted for every import**, regardless of the parent package's `__path__`. So even though steps 1-3 load from pip (and pip's `__path__` points to `site-packages`), our finder still gets called for step 4 and can serve the override.

### The Namespace Shadowing Bug (and Fix)

The original implementation had a bug: it claimed intermediate packages (like `sentry_protos.billing`) and set their `submodule_search_locations` to only the cache directory. This meant:

```
# BUG: If cache has billing/v1/foo_pb2.py but NOT billing/v1/bar_pb2.py,
# bar_pb2 becomes unimportable — pip's version is shadowed because
# sentry_protos.billing.__path__ points only to the cache.
```

**The fix**: only intercept `_pb2` leaf module imports. Intermediate packages are left to pip's finder (which sets `__path__` correctly to include all pip-installed modules). The one exception is **new proto domains** — packages that don't exist in pip at all — where we must create the intermediate package ourselves.

```python
# In find_spec():
if self._is_local_package(fullname) and not _pip_package_has(fullname):
    return self._make_package_spec(fullname)  # new domain
return None  # let pip handle it
```

### New Proto Domains

When you add a completely new proto domain (e.g., `sentry_protos.my_new_service.v1.foo_pb2`) that doesn't exist in the pip-installed `sentry-protos` package:

1. The loader detects that `sentry_protos.my_new_service` is a local package but NOT in pip
2. It creates the intermediate package in the cache directory with an empty `__init__.py`
3. The leaf `_pb2` module is compiled/served normally

This means you can develop entirely new proto packages locally without any changes to `sentry-protos`.

## Directory Structure

### Proto Sources

Proto files must follow the `sentry-protos` package convention:

```
{proto_source_dir}/
  sentry_protos/
    {domain}/
      v{N}/
        {name}.proto
```

Example:

```
/path/to/sentry-protos/proto/
  sentry_protos/
    billing/
      v1/
        data_category.proto
        usage.proto
    snuba/
      v1/
        trace_item.proto
```

### Compiled Cache

The cache mirrors the proto directory structure with `_pb2.py` files:

```
.proto_cache/
  sentry_protos/
    __init__.py
    billing/
      __init__.py
      v1/
        __init__.py
        data_category_pb2.py
        usage_pb2.py
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

- **If X exists in pip**: The loader isn't installed. Call `install()` before the import, or check that `SENTRY_PROTO_OVERRIDE_DIR` / `SENTRY_PROTO_DEV_DIR` is set correctly.
- **If X is a new domain**: Ensure the `.proto` source directory has the correct structure (`sentry_protos/X/v1/foo.proto`).

### "ImportError: grpcio-tools is required"

You're in dev mode (on-demand compilation) but `grpcio-tools` is not installed:

```bash
pip install grpcio-tools
```

In production, pre-compile during your build step and set `SENTRY_PROTO_OVERRIDE_DIR` instead of `SENTRY_PROTO_DEV_DIR`.

### Proto changes aren't picked up

- **Dev mode**: The loader checks mtime on every import. If the `.proto` file's mtime hasn't changed, the cached version is served. Touch the file: `touch path/to/file.proto`.
- **Prod mode**: Re-run the compiler: `python -m sentry.utils.proto_compiler compile --source ... --output ... --force`.
- **Stale sys.modules cache**: Python caches imported modules in `sys.modules`. If the module was already imported in this process, restart the process or use `importlib.reload()`.

### "Proto file is not under any include path"

The `.proto` file's absolute path doesn't start with any of the configured source directories. Check that `--source` / `SENTRY_PROTO_DEV_DIR` points to the correct root (the directory that contains `sentry_protos/`, not `sentry_protos/` itself).

### Cache directory not writable

In containerized environments, `.proto_cache/` (or the configured override directory) must be writable for compilation. For read-only filesystems, pre-compile during the build step and mount the cache as a read-only volume.
