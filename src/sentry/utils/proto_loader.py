"""
Proto loader: runtime import hook for sentry_protos overrides.

Serves pre-compiled _pb2 modules from a configurable override directory,
falling back to the pip-installed sentry_protos package for modules not
found locally. Works in both development and production.

In development mode (SENTRY_PROTO_DEV_DIR is set), also compiles .proto
source files on demand when they change.

Configuration (environment variables):
    SENTRY_PROTO_OVERRIDE_DIR: Directory with pre-compiled _pb2 files.
        Defaults to {repo_root}/.proto_cache
    SENTRY_PROTO_DEV_DIR: Directory with .proto source files.
        Enables on-demand compilation (requires grpcio-tools).
        Can also place files in {repo_root}/proto/.

How it works:
    The loader installs a MetaPathFinder at the front of sys.meta_path.
    Python consults meta-path finders for EVERY import, regardless of
    the parent package's __path__. This is what makes the override work:
    even though ``sentry_protos`` is installed via pip, our finder gets
    first crack at resolving any ``sentry_protos.*..*_pb2`` import.

    For _pb2 imports: check the override directory, optionally compile
    from source (dev mode), return a spec if found or None to fall
    through to pip.

    For intermediate packages (sentry_protos.billing.v1): return None
    so pip's finder handles them — UNLESS the package is a new domain
    not present in pip, in which case we create it.

    This design avoids the "namespace shadowing" bug where claiming
    intermediate packages would set their __path__ to only the cache
    directory, making pip-installed sibling modules invisible.

Usage:
    from sentry_protos.billing.v1 import data_category_pb2

See PROTO_OVERRIDE.md for full documentation.
"""

from __future__ import annotations

import importlib.abc
import importlib.machinery
import importlib.util
import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[3]
LOCAL_PROTO_DIR = REPO_ROOT / "proto"
DEFAULT_OVERRIDE_DIR = REPO_ROOT / ".proto_cache"

_installed = False


def _get_override_dir() -> Path:
    """Return the directory where pre-compiled _pb2.py overrides live.

    Configurable via SENTRY_PROTO_OVERRIDE_DIR.  Defaults to
    ``{repo_root}/.proto_cache``, which is gitignored.
    """
    env = os.environ.get("SENTRY_PROTO_OVERRIDE_DIR")
    if env:
        return Path(env).resolve()
    return DEFAULT_OVERRIDE_DIR


def _get_dev_dirs() -> list[Path]:
    """Return proto source directories for on-demand compilation.

    Checks two locations in priority order:
    1. ``{repo_root}/proto/`` — for local proto files checked into the repo
    2. ``SENTRY_PROTO_DEV_DIR`` env var — typically a sentry-protos checkout

    Returns an empty list when neither is configured, which disables
    on-demand compilation (prod mode).
    """
    dirs: list[Path] = []
    if LOCAL_PROTO_DIR.is_dir():
        dirs.append(LOCAL_PROTO_DIR)
    env = os.environ.get("SENTRY_PROTO_DEV_DIR")
    if env:
        p = Path(env).resolve()
        if p.is_dir():
            dirs.append(p)
    return dirs


def _cached_pb2_path(module_name: str, override_dir: Path) -> Path:
    """Map a dotted module name to its expected _pb2.py file path.

    Example::
        _cached_pb2_path("sentry_protos.billing.v1.data_category_pb2", cache)
        -> cache/sentry_protos/billing/v1/data_category_pb2.py
    """
    parts = module_name.split(".")
    return override_dir / os.path.join(*parts[:-1]) / (parts[-1] + ".py")


def _pip_package_has(fullname: str) -> bool:
    """Check if a package directory exists in the pip-installed sentry_protos.

    This is the key function for avoiding namespace shadowing.  When the
    loader encounters an intermediate package import like
    ``sentry_protos.billing.v1``, it calls this to check whether pip
    already provides that package.  If pip has it, we return None from
    find_spec so pip's finder handles it with the correct ``__path__``.

    Implementation notes:
    - Only checks for directories (packages), not leaf modules.
    - Safe to call from within a MetaPathFinder: it only queries the
      filesystem via Path.is_dir(), never triggers additional imports.
    - Checks sys.modules first because sentry_protos is always imported
      before any of its subpackages (Python imports parents first).
    - Falls back to importlib.util.find_spec for the cold-start case.
      This won't recurse because our finder ignores bare "sentry_protos"
      (it only matches "sentry_protos." with a trailing dot).
    """
    sp = sys.modules.get("sentry_protos")
    if sp is not None:
        pip_file = getattr(sp, "__file__", None)
        if pip_file is None:
            return False
        pip_root = Path(pip_file).parent
    else:
        try:
            spec = importlib.util.find_spec("sentry_protos")
        except (ModuleNotFoundError, ValueError):
            return False
        if spec is None or spec.origin is None:
            return False
        pip_root = Path(spec.origin).parent

    parts = fullname.split(".")
    # Strip the leading "sentry_protos" — pip_root IS the sentry_protos dir.
    rel = os.path.join(*parts[1:])
    return (pip_root / rel).is_dir()


class _ProtoFinder(importlib.abc.MetaPathFinder):
    """Import hook that serves proto overrides with transparent pip fallback.

    Inserted at sys.meta_path[0] so it is consulted before all other
    finders.  The key design constraint is avoiding "namespace shadowing":

    WRONG (old approach):
        Claim intermediate packages like sentry_protos.billing with
        submodule_search_locations=[cache_dir].  This hides ALL pip-installed
        modules under sentry_protos.billing — any _pb2 NOT in the cache
        becomes unimportable.

    RIGHT (current approach):
        Only intercept _pb2 leaf module imports.  Let pip handle intermediate
        packages so their __path__ includes the pip install directory.
        MetaPathFinders are always consulted regardless of parent __path__,
        so our _pb2 overrides still take precedence.

    The one exception: for entirely new proto domains that don't exist in
    pip (e.g., a new ``sentry_protos.new_service`` package), we DO create
    the intermediate package because no other finder can.
    """

    def __init__(
        self,
        override_dir: Path,
        dev_dirs: list[Path] | None = None,
    ) -> None:
        self._override_dir = override_dir
        self._dev_dirs = dev_dirs or []

    def find_spec(
        self,
        fullname: str,
        path: object = None,
        target: object = None,
    ) -> importlib.machinery.ModuleSpec | None:
        # Only handle sentry_protos.* imports (with dot — excludes the
        # bare sentry_protos package itself, which we always let pip handle).
        if not fullname.startswith("sentry_protos."):
            return None

        # Leaf _pb2 module: this is the primary override mechanism.
        if fullname.endswith("_pb2"):
            return self._handle_pb2(fullname)

        # gRPC stubs: not handled by this loader.
        if fullname.endswith("_pb2_grpc"):
            return None

        # Intermediate packages (e.g., sentry_protos.billing.v1):
        # Only handle if this is a NEW domain not present in pip.
        # If pip has it, returning None lets pip load it with its own
        # __path__, preserving access to all pip-installed siblings.
        if self._is_local_package(fullname) and not _pip_package_has(fullname):
            return self._make_package_spec(fullname)

        return None

    def _handle_pb2(self, fullname: str) -> importlib.machinery.ModuleSpec | None:
        """Resolve a _pb2 module from the override directory.

        In dev mode, triggers on-demand compilation if the .proto source
        is newer than the cached output.  In prod mode (no dev_dirs),
        only checks for pre-compiled files.
        """
        cached = _cached_pb2_path(fullname, self._override_dir)

        if self._dev_dirs:
            self._maybe_compile(fullname, cached)

        if not cached.exists():
            # No override found — return None to fall through to pip.
            return None

        return importlib.util.spec_from_file_location(fullname, cached)

    def _maybe_compile(self, fullname: str, cached: Path) -> None:
        """Compile a proto on demand if the source is newer than the cache.

        The proto_compiler import is deferred (not at module level) because:
        1. In prod mode, _maybe_compile is never called (no dev_dirs).
        2. proto_compiler imports grpcio-tools lazily, so just importing
           proto_compiler is safe — but we avoid it when unnecessary.
        """
        from sentry.utils.proto_compiler import (
            compile_lock,
            compile_proto,
            find_proto_file,
            needs_recompile,
        )

        proto_path = find_proto_file(fullname, self._dev_dirs)
        if proto_path is None:
            return

        with compile_lock:
            if needs_recompile(proto_path, cached):
                compile_proto(proto_path, self._dev_dirs, self._override_dir)

    def _is_local_package(self, fullname: str) -> bool:
        """Check if a dotted name corresponds to a directory in override or dev dirs."""
        parts = fullname.split(".")
        rel = os.path.join(*parts)

        if (self._override_dir / rel).is_dir():
            return True
        for d in self._dev_dirs:
            if (d / rel).is_dir():
                return True
        return False

    def _make_package_spec(self, fullname: str) -> importlib.machinery.ModuleSpec | None:
        """Create a package spec for a new intermediate directory.

        Only called for proto domains that don't exist in pip.  Creates the
        cache directory structure and an empty __init__.py so Python treats
        it as a regular package.
        """
        parts = fullname.split(".")
        rel = os.path.join(*parts)

        pkg_dir = self._override_dir / rel
        pkg_dir.mkdir(parents=True, exist_ok=True)
        init_file = pkg_dir / "__init__.py"
        if not init_file.exists():
            init_file.touch()

        return importlib.util.spec_from_file_location(
            fullname,
            init_file,
            submodule_search_locations=[str(pkg_dir)],
        )


def install() -> bool:
    """Install the proto loader import hook into ``sys.meta_path``.

    The hook is inserted at position 0 (highest priority) so it is
    consulted before the default PathFinder.  This ensures overrides
    take precedence over the pip-installed sentry_protos package.

    Returns True if installed, False if no proto sources are configured
    (no override dir exists and no dev dirs found).

    Idempotent: safe to call multiple times.
    """
    global _installed
    if _installed:
        return True

    override_dir = _get_override_dir()
    dev_dirs = _get_dev_dirs()

    has_overrides = override_dir.is_dir()
    has_dev = bool(dev_dirs)

    if not has_overrides and not has_dev:
        return False

    # Guard against duplicate installation (e.g., if install() is called
    # from multiple entry points during app startup).
    for f in sys.meta_path:
        if isinstance(f, _ProtoFinder):
            return True

    finder = _ProtoFinder(
        override_dir=override_dir,
        dev_dirs=dev_dirs if has_dev else None,
    )
    sys.meta_path.insert(0, finder)
    _installed = True

    logger.info(
        "Proto loader installed (override=%s, dev=%s)",
        override_dir,
        ", ".join(str(d) for d in dev_dirs) if dev_dirs else "none",
    )
    return True


def clear_cache() -> None:
    """Remove all cached compiled files from the override directory."""
    from sentry.utils.proto_compiler import clear_cache as _clear

    _clear(_get_override_dir())
