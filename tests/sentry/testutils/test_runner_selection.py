from __future__ import annotations

import os
import re
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from typing import Literal
from unittest import mock

import pytest

from pytest_parallel.api import RunInfo, WorkerInfo
from sentry.testutils.pytest import sentry as sentry_plugin
from sentry.testutils.pytest import workers
from sentry.utils.env import in_test_environment


@contextmanager
def _role(role: Literal["controller", "worker", "serial"], index: int | None) -> Iterator[None]:
    run = RunInfo(run_id="test", role=role, collection_seed=None)
    worker = None if index is None else WorkerInfo(index=index, count=7)
    with (
        mock.patch("pytest_parallel.api.current_run", return_value=run),
        mock.patch("pytest_parallel.api.current_worker", return_value=worker),
    ):
        yield


def _assert_main_slot() -> None:
    assert workers.parallel_worker_index() is None
    assert workers.get_redis_db() == 9
    assert workers.get_redis_cluster_key_prefix() == "test-main:"
    assert workers.get_kafka_topic("test-consumer") == "test-consumer"
    assert workers.get_snuba_url() is None
    assert workers.snowflake_id() == 0


def test_parallel_worker_index_0() -> None:
    with mock.patch.dict(os.environ), _role("worker", 0):
        os.environ.pop("SENTRY_TEST_PER_WORKER_SNUBA", None)
        assert workers.parallel_worker_index() == 0
        assert workers.get_redis_db() == 9
        assert workers.get_redis_cluster_key_prefix() == "test-gw0:"
        assert workers.get_kafka_topic("test-consumer") == "test-consumer-gw0"
        assert workers.get_snuba_url() is None
        assert workers.snowflake_id() == 1
        os.environ["SENTRY_TEST_PER_WORKER_SNUBA"] = "1"
        assert workers.get_snuba_url() == "http://127.0.0.1:1230"


def test_parallel_worker_index_4() -> None:
    with mock.patch.dict(os.environ), _role("worker", 4):
        os.environ.pop("SENTRY_TEST_PER_WORKER_SNUBA", None)
        assert workers.parallel_worker_index() == 4
        assert workers.get_redis_db() == 13
        assert workers.get_redis_cluster_key_prefix() == "test-gw4:"
        assert workers.get_kafka_topic("test-consumer") == "test-consumer-gw4"
        assert workers.get_snuba_url() is None
        assert workers.snowflake_id() == 5
        os.environ["SENTRY_TEST_PER_WORKER_SNUBA"] = "1"
        assert workers.get_snuba_url() == "http://127.0.0.1:1234"


def test_controller_uses_main_slot() -> None:
    with (
        mock.patch.dict(os.environ),
        _role("controller", None),
    ):
        os.environ["SENTRY_TEST_PER_WORKER_SNUBA"] = "1"
        _assert_main_slot()


def test_serial_uses_main_slot() -> None:
    with (
        mock.patch.dict(os.environ),
        _role("serial", None),
    ):
        os.environ["SENTRY_TEST_PER_WORKER_SNUBA"] = "1"
        _assert_main_slot()


def test_in_test_environment_parallel_worker() -> None:
    with mock.patch.object(sys, "argv", ["python"]), mock.patch.dict(os.environ):
        os.environ.pop("SENTRY_IN_TEST_ENVIRONMENT", None)
        os.environ.pop("_PYTEST_PARALLEL_WORKER", None)
        assert in_test_environment() is False
        os.environ["_PYTEST_PARALLEL_WORKER"] = "1"
        assert in_test_environment() is True


def test_selenium_controller_options_skip_parallel_workers() -> None:
    from sentry.testutils.pytest import selenium

    get_option = mock.Mock()
    get_ini = mock.Mock()
    config = SimpleNamespace(option=SimpleNamespace(), getoption=get_option, getini=get_ini)
    with _role("worker", 0):
        selenium.pytest_configure(config)
    get_option.assert_not_called()
    get_ini.assert_not_called()


def test_pytest_parallel_max_workers() -> None:
    with mock.patch.dict(os.environ):
        os.environ.pop("SENTRY_TEST_PER_WORKER_SNUBA", None)
        assert sentry_plugin.pytest_parallel_max_workers() == 7
        os.environ["SENTRY_TEST_PER_WORKER_SNUBA"] = "1"
        assert sentry_plugin.pytest_parallel_max_workers() == 7


def test_parallel_hooks_registered(request: pytest.FixtureRequest) -> None:
    for name in ("pytest_parallel_max_workers", "pytest_parallel_worker_env"):
        hook = getattr(request.config.hook, name)
        assert any(
            impl.function.__module__ == "sentry.testutils.pytest.sentry"
            for impl in hook.get_hookimpls()
        )


def test_database_suffix_fixture_overrides_pytest_django(request: pytest.FixtureRequest) -> None:
    defs = request.session._fixturemanager.getfixturedefs(
        "django_db_modify_db_settings_parallel_suffix", request.node
    )
    assert defs is not None
    assert defs[-1].func.__module__ == "sentry.testutils.pytest.sentry"


def test_database_suffix_parallel_worker() -> None:
    assert workers.database_suffix(4) == "gw4"


def test_database_suffix_parallel_controller() -> None:
    assert workers.database_suffix(None) is None


def test_effective_database_names_use_worker_suffix(request: pytest.FixtureRequest) -> None:
    from django.conf import settings

    aliases = ("default", "control", "secondary")
    original_names = {alias: settings.DATABASES[alias]["NAME"] for alias in aliases}
    request.getfixturevalue("django_db_modify_db_settings")
    suffix = workers.database_suffix(workers.parallel_worker_index())

    for alias in aliases:
        database = settings.DATABASES[alias]
        assert database["NAME"] == original_names[alias]
        test_name = database.get("TEST", {}).get("NAME") or f"test_{database['NAME']}"
        if suffix is None:
            assert re.search(r"_gw\d+$", test_name) is None
        else:
            assert test_name.endswith(f"_{suffix}")
        assert re.search(r"_gw\d+_gw\d+$", test_name) is None


def test_parallel_run_shares_cell_name_and_worker_snowflakes() -> None:
    from django.conf import settings

    setting_names = (
        "SILO_MODE",
        "SENTRY_LOCAL_CELL",
        "SENTRY_FALLBACK_CELL",
        "SENTRY_SUBNET_SECRET",
        "SENTRY_CONTROL_ADDRESS",
        "APIGATEWAY_PROXY_SKIP_RELAY",
    )
    settings_to_restore = {name: getattr(settings, name, None) for name in setting_names}

    with (
        mock.patch.dict(os.environ),
        mock.patch.multiple(settings, create=True, **settings_to_restore),
        mock.patch.object(
            sentry_plugin.random,
            "Random",
            wraps=sentry_plugin.random.Random,
        ) as random_factory,
        mock.patch.object(sentry_plugin, "Cell") as cell_factory,
        mock.patch.object(sentry_plugin, "TestEnvCellDirectory"),
        mock.patch.object(sentry_plugin.cell, "set_global_directory"),
        mock.patch.object(sentry_plugin, "monkey_patch_single_process_silo_mode_state"),
    ):
        with _role("controller", None):
            sentry_plugin._configure_test_env_cells()
        with _role("worker", 0):
            sentry_plugin._configure_test_env_cells()
        with _role("worker", 1):
            sentry_plugin._configure_test_env_cells()

        random_factory.assert_has_calls([mock.call("test")] * 3)
        cells = [call.args for call in cell_factory.call_args_list]
        assert [call[0] for call in cells] == [cells[0][0]] * 3
        assert [call[1] for call in cells] == [0, 1, 2]


def test_worker_env_removes_parent_process_state_from_dict() -> None:
    with mock.patch.dict(os.environ):
        os.environ["DJANGO_SETTINGS_MODULE"] = "sentinel.settings"
        env = {
            "DJANGO_SETTINGS_MODULE": "sentry.conf.server",
            "PYTEST_SHARD_PARTS": "parent-parts.json",
            "KEEP": "1",
        }
        sentry_plugin.pytest_parallel_worker_env(env, 3)
        assert "DJANGO_SETTINGS_MODULE" not in env
        assert "PYTEST_SHARD_PARTS" not in env
        assert env["KEEP"] == "1"
        assert os.environ["DJANGO_SETTINGS_MODULE"] == "sentinel.settings"


def test_service_lock_second_acquire_raises(tmp_path: Path) -> None:
    path = tmp_path / "sentry-service.lock"
    held = workers.acquire_service_lock(path)
    try:
        with pytest.raises(BlockingIOError):
            workers.acquire_service_lock(path)
    finally:
        os.close(held)
