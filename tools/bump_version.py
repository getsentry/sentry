from __future__ import annotations

import argparse
import subprocess
import tomllib
from collections.abc import Sequence


def extract_packages(package_specs: list[str]) -> set[str]:
    names = set()
    for spec in package_specs:
        parts = spec.split(">=")
        if len(parts) == 1:
            raise SystemExit(
                f"Only >= is allowed for packages in pyproject.toml. Offfending spec: {spec}"
            )
        names.add(parts[0])
    return names


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

    if is_dev:
        return subprocess.call(("uv", "add", "--dev", f"{args.package}>={args.version}"))

    return subprocess.call(("uv", "add", f"{args.package}>={args.version}"))


if __name__ == "__main__":
    raise SystemExit(main())
