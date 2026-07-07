from __future__ import annotations

import argparse
import subprocess
import sys
import time
import tomllib
from collections.abc import Sequence

# It can take up to ~20 minutes between a new version being merged into our
# internal pypi and it becoming resolvable by `uv`.
RETRY_TIMEOUT_SECONDS = 20 * 60
RETRY_INTERVAL_SECONDS = 60

_RESOLUTION_FAILURE_MARKERS = (
    "No solution found when resolving dependencies",
    "unsatisfiable",
)


def extract_packages(package_specs: list[str]) -> set[str]:
    names = set()
    for spec in package_specs:
        # Split on version specifiers or extras bracket
        for sep in ("[", ">=", "==", "~=", "<=", "<", ">"):
            if sep in spec:
                names.add(spec.split(sep)[0])
                break
        else:
            names.add(spec)
    return names


def _uv_add(package: str, version: str, *, dev: bool) -> tuple[int, str]:
    cmd = ["uv", "add"]
    if dev:
        cmd.append("--dev")
    cmd.append(f"{package}>={version}")

    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    print(proc.stdout, end="")
    return proc.returncode, proc.stdout


def _is_resolution_failure(output: str) -> bool:
    return any(marker in output for marker in _RESOLUTION_FAILURE_MARKERS)


def add_with_retry(
    package: str,
    version: str,
    *,
    dev: bool,
    timeout: float = RETRY_TIMEOUT_SECONDS,
    interval: float = RETRY_INTERVAL_SECONDS,
) -> int:
    deadline = time.monotonic() + timeout
    while True:
        returncode, output = _uv_add(package, version, dev=dev)
        if returncode == 0:
            return 0

        # Only retry while the failure is the requested version not yet being
        # available in our internal pypi; any other error fails fast.
        if not _is_resolution_failure(output):
            return returncode

        if time.monotonic() >= deadline:
            print(
                f"timed out waiting for {package} {version} to become "
                "available in the internal pypi",
                file=sys.stderr,
            )
            return returncode

        print(
            f"{package} {version} not yet resolvable; retrying in {interval:.0f}s",
            file=sys.stderr,
        )
        time.sleep(interval)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("package")
    parser.add_argument("version")
    args = parser.parse_args(argv)

    with open("pyproject.toml", "rb") as f:
        pyproject = tomllib.load(f)
        packages = extract_packages(pyproject["project"]["dependencies"])
        dev_packages = extract_packages(pyproject["dependency-groups"]["dev"])

    is_dev = args.package in dev_packages
    if not is_dev and args.package not in packages:
        raise SystemExit(
            f"{args.package} not in pyproject.toml, add it first via `uv add [--dev] {args.package}>={args.version}`"
        )

    return add_with_retry(args.package, args.version, dev=is_dev)


if __name__ == "__main__":
    raise SystemExit(main())
