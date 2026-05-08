"""
Runtime proto compiler for development.

When SENTRY_PROTO_DEV_DIR is set (or a local proto/ directory exists),
this module installs a custom import hook that compiles .proto files
to _pb2.py modules at import time, bypassing the installed sentry-protos
pip package.

This eliminates the release cycle friction when iterating on proto
definitions during development.

Usage:
    # Point to your sentry-protos checkout:
    export SENTRY_PROTO_DEV_DIR=/path/to/sentry-protos/proto

    # Or place .proto files directly in {repo_root}/proto/sentry_protos/...

    # Then just import as usual:
    from sentry_protos.billing.v1 import data_category_pb2
"""

from __future__ import annotations

import importlib
import importlib.abc
import importlib.machinery
import importlib.util
import logging
import os
import sys
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[3]
LOCAL_PROTO_DIR = REPO_ROOT / "proto"
CACHE_DIR = REPO_ROOT / ".proto_cache"

_compile_lock = threading.RLock()
_installed = False


def _get_proto_dev_dirs() -> list[Path]:
    """Return proto source directories in priority order."""
    dirs: list[Path] = []

    if LOCAL_PROTO_DIR.is_dir():
        dirs.append(LOCAL_PROTO_DIR)

    env_dir = os.environ.get("SENTRY_PROTO_DEV_DIR")
    if env_dir:
        p = Path(env_dir).resolve()
        if p.is_dir():
            dirs.append(p)

    return dirs


def _find_proto_file(module_name: str, proto_dirs: list[Path]) -> Path | None:
    """Map a module name to a .proto file path.

    sentry_protos.billing.v1.foo_pb2
      -> sentry_protos/billing/v1/foo.proto
    """
    parts = module_name.split(".")
    if len(parts) < 2 or parts[0] != "sentry_protos":
        return None

    last = parts[-1]
    if last.endswith("_pb2"):
        parts[-1] = last.removesuffix("_pb2") + ".proto"
    elif last.endswith("_pb2_grpc"):
        return None
    else:
        return None

    rel = os.path.join(*parts)

    for d in proto_dirs:
        candidate = d / rel
        if candidate.is_file():
            return candidate

    return None


def _cached_pb2_path(module_name: str) -> Path:
    """Return the path where a compiled _pb2.py should be cached."""
    parts = module_name.split(".")
    return CACHE_DIR / os.path.join(*parts[:-1]) / (parts[-1] + ".py")


def _needs_recompile(proto_path: Path, cached_path: Path) -> bool:
    if not cached_path.exists():
        return True
    try:
        return proto_path.stat().st_mtime > cached_path.stat().st_mtime
    except OSError:
        return True


def _ensure_init_files(directory: Path) -> None:
    """Create __init__.py in all directories from CACHE_DIR down to directory."""
    rel = directory.relative_to(CACHE_DIR)
    current = CACHE_DIR
    for part in rel.parts:
        current = current / part
        init = current / "__init__.py"
        if not init.exists():
            current.mkdir(parents=True, exist_ok=True)
            init.touch()


def _compile_proto(proto_path: Path, proto_dirs: list[Path]) -> bool:
    """Compile a single .proto file using grpc_tools.protoc."""
    try:
        from grpc_tools import protoc
    except ImportError:
        raise ImportError(
            "grpcio-tools is required for runtime proto compilation. "
            "Install it with: pip install grpcio-tools\n"
            "Or disable the proto dev loader by unsetting SENTRY_PROTO_DEV_DIR."
        )

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    include_args: list[str] = []
    for d in proto_dirs:
        include_args.append(f"-I{d}")

    proto_rel = None
    for d in proto_dirs:
        try:
            proto_rel = str(proto_path.relative_to(d))
            break
        except ValueError:
            continue

    if proto_rel is None:
        logger.error("Proto file %s is not under any include path", proto_path)
        return False

    args = [
        "grpc_tools.protoc",
        *include_args,
        f"--python_out={CACHE_DIR}",
        proto_rel,
    ]

    # Generate .pyi stubs if mypy-protobuf is available
    try:
        import mypy_protobuf  # noqa: F401

        args.append(f"--mypy_out={CACHE_DIR}")
    except ImportError:
        pass

    result = protoc.main(args)

    if result != 0:
        logger.error("protoc failed for %s (exit code %d)", proto_path, result)
        return False

    # Create __init__.py files in all intermediate package directories
    parts = proto_rel.replace(".proto", "").split(os.sep)
    pkg_dir = CACHE_DIR
    for part in parts[:-1]:
        pkg_dir = pkg_dir / part
        _ensure_init_files(pkg_dir)

    return True


class _ProtoDevFinder(importlib.abc.MetaPathFinder):
    """Import hook that compiles .proto files on demand."""

    def __init__(self, proto_dirs: list[Path]) -> None:
        self._proto_dirs = proto_dirs

    def find_spec(
        self,
        fullname: str,
        path: object = None,
        target: object = None,
    ) -> importlib.machinery.ModuleSpec | None:
        if not fullname.startswith("sentry_protos."):
            return None

        if not (fullname.endswith("_pb2") or fullname == "sentry_protos"):
            # Handle intermediate package imports (e.g., sentry_protos.billing.v1)
            # by checking if any .proto files exist under that path
            if self._is_proto_package(fullname):
                return self._make_package_spec(fullname)
            return None

        if fullname == "sentry_protos":
            return None

        proto_path = _find_proto_file(fullname, self._proto_dirs)
        if proto_path is None:
            return None

        cached = _cached_pb2_path(fullname)

        with _compile_lock:
            if _needs_recompile(proto_path, cached):
                if not _compile_proto(proto_path, self._proto_dirs):
                    return None

        if not cached.exists():
            return None

        return importlib.util.spec_from_file_location(fullname, cached)

    def _is_proto_package(self, fullname: str) -> bool:
        """Check if this module name corresponds to a directory with .proto files."""
        parts = fullname.split(".")
        rel = os.path.join(*parts)
        for d in self._proto_dirs:
            candidate = d / rel
            if candidate.is_dir():
                return True
        return False

    def _make_package_spec(self, fullname: str) -> importlib.machinery.ModuleSpec | None:
        """Create a package spec for intermediate directories."""
        parts = fullname.split(".")
        rel = os.path.join(*parts)

        # Ensure the cache directory and __init__.py exist
        pkg_cache = CACHE_DIR / rel
        pkg_cache.mkdir(parents=True, exist_ok=True)
        init_file = pkg_cache / "__init__.py"
        if not init_file.exists():
            init_file.touch()
        _ensure_init_files(pkg_cache)

        return importlib.util.spec_from_file_location(
            fullname,
            init_file,
            submodule_search_locations=[str(pkg_cache)],
        )


def install() -> bool:
    """Install the proto dev loader import hook.

    Returns True if the hook was installed, False if no proto dev
    directories are configured.
    """
    global _installed
    if _installed:
        return True

    proto_dirs = _get_proto_dev_dirs()
    if not proto_dirs:
        return False

    # Don't install twice
    for finder in sys.meta_path:
        if isinstance(finder, _ProtoDevFinder):
            return True

    finder = _ProtoDevFinder(proto_dirs)
    sys.meta_path.insert(0, finder)
    _installed = True

    dirs_str = ", ".join(str(d) for d in proto_dirs)
    logger.info("Proto dev loader installed. Proto sources: %s", dirs_str)
    return True


def clear_cache() -> None:
    """Remove all cached _pb2.py files."""
    import shutil

    if CACHE_DIR.exists():
        shutil.rmtree(CACHE_DIR)
        logger.info("Cleared proto cache at %s", CACHE_DIR)
