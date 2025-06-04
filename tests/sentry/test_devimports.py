from __future__ import annotations

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


def extract_packages(text_content: str) -> set[str]:
    return {line.split("==")[0] for line in text_content.splitlines() if "==" in line}


@functools.lru_cache
def dev_dependencies() -> tuple[str, ...]:
    with open("requirements-dev-frozen.txt") as f:
        dev_packages = extract_packages(f.read())
    with open("requirements-frozen.txt") as f:
        prod_packages = extract_packages(f.read())

    # We have some packages that are both runtime + dev
    # but we only care about packages that are exclusively dev deps
    devonly = dev_packages - prod_packages

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
def test_startup_imports(pkg):
    validate_package(pkg, EXCLUDED, XFAIL)
