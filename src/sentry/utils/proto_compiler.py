"""
Proto compiler: build .proto files into Python _pb2 modules.

CLI:
    python -m sentry.utils.proto_compiler compile \\
        --source proto --output .proto_cache

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

compile_lock = threading.RLock()


def needs_recompile(proto_path: Path, cached_path: Path) -> bool:
    if not cached_path.exists():
        return True
    try:
        return proto_path.stat().st_mtime > cached_path.stat().st_mtime
    except OSError:
        return True


def _ensure_init_files(directory: Path, root: Path) -> None:
    rel = directory.relative_to(root)
    current = root
    for part in rel.parts:
        current = current / part
        init = current / "__init__.py"
        if not init.exists():
            current.mkdir(parents=True, exist_ok=True)
            init.touch()


def compile_proto(proto_path: Path, proto_dirs: list[Path], output_dir: Path) -> bool:
    """Compile a single .proto file using grpc_tools.protoc."""
    try:
        from grpc_tools import protoc
    except ImportError:
        raise ImportError(
            "grpcio-tools is required for proto compilation. "
            "Install it with: pip install grpcio-tools"
        )

    output_dir.mkdir(parents=True, exist_ok=True)

    include_args = [f"-I{d}" for d in proto_dirs]

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

    try:
        import mypy_protobuf  # noqa: F401

        args.append(f"--mypy_out={output_dir}")
    except ImportError:
        pass

    result = protoc.main(args)
    if result != 0:
        logger.error("protoc failed for %s (exit code %d)", proto_path, result)
        return False

    parts = proto_rel.replace(".proto", "").split(os.sep)
    pkg_dir = output_dir
    for part in parts[:-1]:
        pkg_dir = pkg_dir / part
        _ensure_init_files(pkg_dir, output_dir)

    return True


def find_proto_file(module_name: str, proto_dirs: list[Path]) -> Path | None:
    """Map a _pb2 module name to its .proto source file."""
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
    """Compile all .proto files. Returns (compiled, skipped, failed)."""
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
