"""
Proto compiler: build .proto files into Python _pb2 modules.

Use as a build step (CLI or library) to pre-compile protos for
production, or called on-demand by proto_loader in development.

This module intentionally has NO runtime dependency on grpcio-tools
at import time. The ``from grpc_tools import protoc`` import is
deferred to compile_proto() so that production environments can
import proto_loader (which references this module) without needing
the compiler toolchain installed.

CLI:
    python -m sentry.utils.proto_compiler compile \\
        --source /path/to/sentry-protos/proto --output .proto_cache

    python -m sentry.utils.proto_compiler clear --output .proto_cache

See PROTO_OVERRIDE.md for full documentation.
"""

from __future__ import annotations

import argparse
import logging
import os
import shutil
import sys
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

# RLock (reentrant) rather than Lock because proto files can import other
# proto files, and protoc may be invoked recursively via the import hook
# during compilation of dependencies.
compile_lock = threading.RLock()


def needs_recompile(proto_path: Path, cached_path: Path) -> bool:
    """Check whether the cached _pb2.py is stale relative to the .proto source.

    Uses mtime comparison.  Returns True conservatively on any filesystem
    error so that a broken cache never silently serves stale code.
    """
    if not cached_path.exists():
        return True
    try:
        return proto_path.stat().st_mtime > cached_path.stat().st_mtime
    except OSError:
        return True


def _ensure_init_files(directory: Path, root: Path) -> None:
    """Create ``__init__.py`` in every directory between *root* and *directory*.

    Python's import system requires ``__init__.py`` to exist at each level
    of a regular package hierarchy.  Without these, ``from sentry_protos.X.Y
    import Z_pb2`` would fail with a ModuleNotFoundError on the intermediate
    packages even though the leaf _pb2.py file exists.
    """
    rel = directory.relative_to(root)
    current = root
    for part in rel.parts:
        current = current / part
        init = current / "__init__.py"
        if not init.exists():
            current.mkdir(parents=True, exist_ok=True)
            init.touch()


def compile_proto(proto_path: Path, proto_dirs: list[Path], output_dir: Path) -> bool:
    """Compile a single .proto file into a _pb2.py module using grpc_tools.protoc.

    Args:
        proto_path: Absolute path to the .proto source file.
        proto_dirs: Directories to pass as ``-I`` include paths to protoc.
            Protoc resolves ``import`` statements in .proto files relative to
            these directories, so all transitive dependencies must be reachable.
        output_dir: Root directory for compiled output.  The directory structure
            mirrors the proto package hierarchy::

                output_dir/
                  sentry_protos/
                    billing/
                      v1/
                        data_category_pb2.py

    Returns:
        True on success, False if protoc reports an error.

    Raises:
        ImportError: If grpcio-tools is not installed.
    """
    # Lazy import: grpcio-tools is a build-time dependency, not a runtime one.
    # Production images may not have it installed.
    try:
        from grpc_tools import protoc
    except ImportError:
        raise ImportError(
            "grpcio-tools is required for proto compilation. "
            "Install it with: pip install grpcio-tools"
        )

    output_dir.mkdir(parents=True, exist_ok=True)

    # Pass every source directory as a protoc include path so that
    # cross-file ``import`` directives in .proto files resolve correctly.
    include_args = [f"-I{d}" for d in proto_dirs]

    # protoc expects the file argument as a path relative to one of the
    # include directories, not an absolute path.
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
        f"--python_out={output_dir}",
        proto_rel,
    ]

    # If mypy-protobuf is installed, generate .pyi type stubs alongside
    # the _pb2.py files.  This is optional — the compiled modules work
    # fine without stubs, but stubs improve IDE autocomplete and mypy
    # coverage for proto-generated code.
    try:
        import mypy_protobuf  # noqa: F401

        args.append(f"--mypy_out={output_dir}")
    except ImportError:
        pass

    result = protoc.main(args)
    if result != 0:
        logger.error("protoc failed for %s (exit code %d)", proto_path, result)
        return False

    # After compilation, ensure __init__.py files exist at every
    # intermediate package directory so the generated _pb2.py is importable.
    parts = proto_rel.replace(".proto", "").split(os.sep)
    pkg_dir = output_dir
    for part in parts[:-1]:
        pkg_dir = pkg_dir / part
        _ensure_init_files(pkg_dir, output_dir)

    return True


def find_proto_file(module_name: str, proto_dirs: list[Path]) -> Path | None:
    """Map a Python _pb2 module name to its .proto source file.

    The mapping convention follows the sentry-protos package structure::

        sentry_protos.billing.v1.data_category_pb2
          -> sentry_protos/billing/v1/data_category.proto

    Only handles ``sentry_protos.*_pb2`` module names.  Returns None for
    non-matching names, ``_pb2_grpc`` modules, or when no .proto source
    exists in any of the provided directories.
    """
    parts = module_name.split(".")
    if len(parts) < 2 or parts[0] != "sentry_protos":
        return None

    last = parts[-1]
    if not last.endswith("_pb2"):
        return None

    parts[-1] = last.removesuffix("_pb2") + ".proto"
    rel = os.path.join(*parts)

    for d in proto_dirs:
        candidate = d / rel
        if candidate.is_file():
            return candidate

    return None


def compile_all(
    proto_dirs: list[Path],
    output_dir: Path,
    force: bool = False,
) -> tuple[int, int, int]:
    """Compile all .proto files found under *proto_dirs* into *output_dir*.

    Walks each directory recursively for ``*.proto`` files.  Skips files
    whose cached output is already up-to-date (unless *force* is True).

    Returns:
        A tuple of (compiled_count, skipped_count, failed_count).
    """
    compiled = 0
    skipped = 0
    failed = 0

    for d in proto_dirs:
        for proto_path in sorted(d.rglob("*.proto")):
            rel = proto_path.relative_to(d)
            cached = output_dir / str(rel).replace(".proto", "_pb2.py")

            if not force and not needs_recompile(proto_path, cached):
                skipped += 1
                continue

            with compile_lock:
                if compile_proto(proto_path, proto_dirs, output_dir):
                    compiled += 1
                else:
                    failed += 1

    return compiled, skipped, failed


def clear_cache(cache_dir: Path) -> None:
    """Delete the entire compiled cache directory."""
    if cache_dir.exists():
        shutil.rmtree(cache_dir)
        logger.info("Cleared proto cache at %s", cache_dir)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point for proto compilation.

    Subcommands:
        compile  Compile .proto files from --source dirs into --output dir.
        clear    Remove all files from the --output cache directory.
    """
    parser = argparse.ArgumentParser(description="Compile .proto files into Python _pb2 modules")
    sub = parser.add_subparsers(dest="command", required=True)

    cp = sub.add_parser("compile", help="Compile proto files")
    cp.add_argument(
        "--source",
        required=True,
        action="append",
        type=Path,
        help="Proto source directory (repeatable)",
    )
    cp.add_argument("--output", required=True, type=Path)
    cp.add_argument("--force", action="store_true")

    clr = sub.add_parser("clear", help="Clear compiled cache")
    clr.add_argument("--output", required=True, type=Path)

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO)

    if args.command == "compile":
        compiled, skipped, failed = compile_all(args.source, args.output, args.force)
        logger.info("Done: %d compiled, %d skipped, %d failed", compiled, skipped, failed)
        return 1 if failed > 0 else 0

    if args.command == "clear":
        clear_cache(args.output)
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
