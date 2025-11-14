from __future__ import annotations
from typing import int

import functools
import importlib.metadata
import subprocess
import sys

import pytest

XFAIL = (
    # XXX: ideally these should get fixed
    "sentry.sentry_metrics.client.snuba",
    "sentry.web.debug_urls",
)
EXCLUDED = ("sentry.testutils.", "sentry.web.frontend.debug.")


def extract_packages(lines: list[str]) -> set[str]:
    packages = set()
    for line in lines:
        spec = line.split(" ")[0]
        packages.add(spec.split("==")[0])
    return packages


@functools.lru_cache
def dev_dependencies() -> tuple[str, ...]:
    out = subprocess.run(
        ("uv", "export", "--no-hashes", "--no-annotate", "--no-header"),
        capture_output=True,
    )
    all_packages = extract_packages(out.stdout.decode().splitlines())

    out = subprocess.run(
        ("uv", "export", "--no-dev", "--no-hashes", "--no-annotate", "--no-header"),
        capture_output=True,
    )
    prod_packages = extract_packages(out.stdout.decode().splitlines())

    # We have some packages that are both runtime + dev
    # but we only care about packages that are exclusively dev deps
    devonly = all_packages - prod_packages

    module_names = []
    for mod, packages in importlib.metadata.packages_distributions().items():
        if devonly.intersection(packages):
            module_names.append(mod)
    return tuple(sorted(module_names))


def validate_package(
    package: str,
    excluded: tuple[str, ...],
    xfail: tuple[str, ...],
) -> None:
    script = f"""\
import builtins
import sys

DISALLOWED = frozenset({dev_dependencies()!r})
EXCLUDED = {excluded!r}
XFAIL = frozenset({xfail!r})

orig = builtins.__import__

def _import(name, globals=None, locals=None, fromlist=(), level=0):
    base, *_ = name.split('.')
    if level == 0 and base in DISALLOWED:
        raise ImportError(f'disallowed dev import: {{name}}')
    else:
        return orig(name, globals=globals, locals=locals, fromlist=fromlist, level=level)

builtins.__import__ = _import

import sentry.conf.server_mypy

from django.conf import settings
settings.DEBUG = False

import pkgutil

pkg = __import__({package!r})
names = [
    name
    for _, name, _ in pkgutil.walk_packages(pkg.__path__, f'{{pkg.__name__}}.')
    if name not in XFAIL and not name.startswith(EXCLUDED)
]

for name in names:
    try:
        __import__(name)
    except SystemExit:
        raise SystemExit(f'unexpected exit from {{name}}')
    except Exception:
        print(f'error importing {{name}}:', flush=True)
        print(flush=True)
        raise

for xfail in {xfail!r}:
    try:
        __import__(xfail)
    except ImportError:  # expected failure
        pass
    else:
        raise SystemExit(f'unexpected success importing {{xfail}}')
"""

    env = {"SENTRY_ENVIRONMENT": "production"}
    ret = subprocess.run(
        (sys.executable, "-c", script),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    if ret.returncode:
        raise AssertionError(ret.stdout)


@pytest.mark.parametrize("pkg", ("sentry", "sentry_plugins"))
def test_startup_imports(pkg: str) -> None:
    validate_package(pkg, EXCLUDED, XFAIL)
