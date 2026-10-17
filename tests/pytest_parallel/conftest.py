from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _isolate_nested_pytest(monkeypatch: pytest.MonkeyPatch) -> None:
    # These tests start their own pytest sessions, in subprocesses and in-process.
    # Those sessions must load only pytest-parallel: Sentry's settings, the CI
    # PYTEST_ADDOPTS (--reruns, --fail-slow), the shard plugin and CI's forced
    # colors all break them.
    monkeypatch.setenv("PYTEST_DISABLE_PLUGIN_AUTOLOAD", "1")
    monkeypatch.setenv("PYTEST_PLUGINS", "pytest_parallel.plugin")
    monkeypatch.delenv("PYTEST_ADDOPTS", raising=False)
    monkeypatch.delenv("DJANGO_SETTINGS_MODULE", raising=False)
    monkeypatch.delenv("PY_COLORS", raising=False)
    monkeypatch.delenv("FORCE_COLOR", raising=False)
