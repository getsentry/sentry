from __future__ import annotations

import argparse
import tomllib
from collections.abc import Sequence


def main(argv: Sequence[str] | None = None) -> int:
    """
    We cannot have non-specifier requirements if we want to publish to PyPI
    due to security concerns. This check ensures we don't have/add any URL/VCS
    dependencies in the base requirements file.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("filenames", nargs="*")
    args = parser.parse_args(argv)

    for filename in args.filenames:
        with open(filename, "rb") as f:
            lockfile = tomllib.load(f)
            for package in lockfile["package"]:
                if package["name"] == "sentry":
                    continue

                # non-specifier requirements won't have registry as a source
                package_registry = package["source"].get("registry", "")

                if package_registry not in (
                    "https://pypi.org/simple",
                    "https://pypi.devinfra.sentry.io/simple",
                ):
                    raise SystemExit(
                        f"""
The specifier for package {package['name']} in {filename} isn't allowed:

You cannot use dependencies that are not on internal pypi.

You also cannot use non-specifier requirements.
See PEP440: https://www.python.org/dev/peps/pep-0440/#direct-references"""
                    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
