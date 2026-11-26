import tomllib
from pathlib import Path

import sentry

ROOT = Path(__file__).resolve().parents[2]


def test_package_version_matches_sentry_version() -> None:
    with open(ROOT / "pyproject.toml", "rb") as f:
        pyproject = tomllib.load(f)
    assert pyproject["project"]["version"] == sentry.VERSION


def test_lockfile_version_matches_sentry_version() -> None:
    with open(ROOT / "uv.lock", "rb") as f:
        lock = tomllib.load(f)
    (package,) = (p for p in lock["package"] if p["name"] == "sentry")
    assert package["version"] == sentry.VERSION
