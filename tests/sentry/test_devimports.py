from __future__ import annotations

import importlib.metadata
import re
import subprocess
import sys

import pytest

from sentry.utils import json

requirement_re = re.compile(r"^(?P<name>[a-z0-9-_]+)", re.IGNORECASE)


def extract_packages(text_content: str) -> set[str]:
    parsed: list[str] = []
    for line in text_content.splitlines():
        if not len(line) or line.startswith("-") or line.startswith("#"):
            continue
        match = requirement_re.match(line)
        if match is None:
            continue
        parsed.append(match.group("name"))
    return set(parsed)


@pytest.fixture
def dev_dependencies() -> set[str]:
    with open("./requirements-dev.txt") as f:
        dev_requirements = f.read()
    dev_packages = extract_packages(dev_requirements)
    with open("./requirements-base.txt") as f:
        runtime_requirements = f.read()
    runtime_packages = extract_packages(runtime_requirements)

    module_names: list[str] = []
    # We have some packages that are both runtime + dev
    # but we only care about packages that are exclusively dev deps
    for package in dev_packages - runtime_packages:
        modules = [package]
        # Ideally we'd use importlib.metadata.packages_distributions()
        # but we're not on py3.10 yet.
        # Inspired by https://github.com/python/cpython/blob/e25d8b40cd70744513e190b1ca153087382b6b09/Lib/importlib/metadata/__init__.py#L934
        dist = importlib.metadata.distribution(package)
        top_level = (dist.read_text("top_level.txt") or "").split()
        if top_level:
            modules = top_level
        module_names.extend(modules)
    return set(module_names)


def test_startup_imports(dev_dependencies):
    # Import the urls, endpoints, tasks and models
    script = """
import sys, json
from sentry.runner import configure

configure()

import sentry.app
import sentry.conf.urls
import sentry.api.urls
import sentry.web.urls
import sentry.tasks
import sentry.models

print(json.dumps(list(sys.modules.keys())))
    """
    process = subprocess.run((sys.executable, "-c", script), capture_output=True, env={})
    assert not process.stderr
    loaded_modules = json.loads(process.stdout)
    for module in loaded_modules:
        if module in dev_dependencies:
            raise AssertionError(
                f"Found usage of {module} in production code. Do not use requirements-dev packages in production code."
            )
