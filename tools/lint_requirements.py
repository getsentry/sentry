from __future__ import annotations

import argparse
import json
import tomllib
import urllib.request
from collections.abc import Sequence

_INTERNAL_PYPI = "https://pypi.devinfra.sentry.io/simple"


def _has_upstream_cp313_wheels(name: str, version: str) -> bool | None:
    """
    Returns True if upstream PyPI has satisfactory cp313 wheels for macOS arm64
    or Linux x86_64 (or a pure-Python wheel that covers all platforms).
    Returns None if the upstream check could not be performed (e.g. no network).
    """
    url = f"https://pypi.org/pypi/{name}/{version}/json"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.load(resp)
    except Exception:
        return None

    has_mac = False
    has_linux = False

    for dist in data.get("urls", []):
        if dist.get("packagetype") != "bdist_wheel":
            continue
        fn = dist["filename"]
        if fn.endswith("-none-any.whl"):
            return True
        if "cp313" in fn and "macosx" in fn and "arm64" in fn:
            has_mac = True
        if "cp313" in fn and ("manylinux" in fn or "musllinux" in fn) and "x86_64" in fn:
            has_linux = True

    return has_mac and has_linux


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
                    _INTERNAL_PYPI,
                ):
                    raise SystemExit(
                        f"""
The specifier for package {package["name"]} in {filename} isn't allowed:

Packages must come from pypi.org or the internal Sentry PyPI
(https://pypi.devinfra.sentry.io/simple) for packages that lack
suitable upstream wheels. URL/VCS/local dependencies are not allowed.
See PEP440: https://www.python.org/dev/peps/pep-0440/#direct-references"""
                    )

                if package_registry == _INTERNAL_PYPI:
                    version = package.get("version", "")
                    has_wheels = _has_upstream_cp313_wheels(package["name"], version)
                    if has_wheels:
                        raise SystemExit(
                            f"""
Package {package["name"]}=={version} in {filename} is sourced from internal
PyPI but upstream PyPI already has cp313 wheels for macOS arm64 and/or Linux
x86_64. Remove it from [tool.uv.sources] and no-build-package in pyproject.toml
so it is fetched from pypi.org directly."""
                        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
