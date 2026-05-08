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

Usage:
    from sentry_protos.billing.v1 import data_category_pb2
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
    env = os.environ.get("SENTRY_PROTO_OVERRIDE_DIR")
    if env:
        return Path(env).resolve()
    return DEFAULT_OVERRIDE_DIR


def _get_dev_dirs() -> list[Path]:
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
    parts = module_name.split(".")
    return override_dir / os.path.join(*parts[:-1]) / (parts[-1] + ".py")


def _pip_package_has(fullname: str) -> bool:
    """Check if a package exists in the pip-installed sentry_protos.

    Only checks for directories (packages), not leaf modules.
    Safe to call from within a MetaPathFinder because we only
    query the filesystem, not trigger additional imports.
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
    rel = os.path.join(*parts[1:])
    return (pip_root / rel).is_dir()


class _ProtoFinder(importlib.abc.MetaPathFinder):
    """Import hook that serves proto overrides with pip fallback.

    Only intercepts sentry_protos.*_pb2 leaf module imports.
    Intermediate packages are left to pip's default finder unless
    they represent new proto domains not present in the pip package
    (avoids the namespace shadowing bug where claiming intermediate
    packages would hide pip-installed modules).
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
        if not fullname.startswith("sentry_protos."):
            return None

        if fullname.endswith("_pb2"):
            return self._handle_pb2(fullname)

        if fullname.endswith("_pb2_grpc"):
            return None

        # Intermediate packages: only handle NEW domains not in pip.
        # If pip already has this package, return None so pip's finder
        # loads it with the correct __path__ — no shadowing.
        if self._is_local_package(fullname) and not _pip_package_has(fullname):
            return self._make_package_spec(fullname)

        return None

    def _handle_pb2(self, fullname: str) -> importlib.machinery.ModuleSpec | None:
        cached = _cached_pb2_path(fullname, self._override_dir)

        if self._dev_dirs:
            self._maybe_compile(fullname, cached)

        if not cached.exists():
            return None

        return importlib.util.spec_from_file_location(fullname, cached)

    def _maybe_compile(self, fullname: str, cached: Path) -> None:
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
        parts = fullname.split(".")
        rel = os.path.join(*parts)

        if (self._override_dir / rel).is_dir():
            return True
        for d in self._dev_dirs:
            if (d / rel).is_dir():
                return True
        return False

    def _make_package_spec(self, fullname: str) -> importlib.machinery.ModuleSpec | None:
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
    """Install the proto loader import hook.

    Returns True if installed, False if no proto sources configured.
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
    from sentry.utils.proto_compiler import clear_cache as _clear

    _clear(_get_override_dir())
