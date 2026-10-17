from __future__ import annotations

import importlib.util
import os
import re
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Literal
from unittest import mock

import pytest
from pytest_parallel.api import RunInfo, WorkerInfo

from sentry.testutils.pytest import sentry as sentry_plugin
from sentry.testutils.pytest import workers, xdist
from sentry.utils.env import in_test_environment

_REPO_ROOT = Path(__file__).resolve().parents[3]


def _load_pytest_selected() -> Any:
    path = _REPO_ROOT / ".github" / "workflows" / "scripts" / "pytest-selected.py"
    spec = importlib.util.spec_from_file_location("pytest_selected_script", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


pytest_selected = _load_pytest_selected()


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
    assert xdist.get_redis_db() == 9
    assert xdist.get_redis_cluster_key_prefix() == "test-main:"
    assert xdist.get_kafka_topic("test-consumer") == "test-consumer"
    assert xdist.get_snuba_url() is None
    assert xdist.get_snowflake_id() == 0


def test_parallel_worker_index_0() -> None:
    with mock.patch.dict(os.environ), _role("worker", 0):
        os.environ["PYTEST_XDIST_WORKER"] = "gw5"
        os.environ.pop("XDIST_PER_WORKER_SNUBA", None)
        assert workers.parallel_worker_index() == 0
        assert workers.get_redis_db() == 9
        assert xdist.get_redis_db() == 9
        assert workers.get_redis_cluster_key_prefix() == "test-gw0:"
        assert xdist.get_redis_cluster_key_prefix() == "test-gw0:"
        assert workers.get_kafka_topic("test-consumer") == "test-consumer-gw0"
        assert xdist.get_kafka_topic("test-consumer") == "test-consumer-gw0"
        assert workers.get_snuba_url() is None
        assert xdist.get_snuba_url() is None
        assert workers.snowflake_id() == 1
        assert xdist.get_snowflake_id() == 1
        os.environ["XDIST_PER_WORKER_SNUBA"] = "1"
        assert workers.get_snuba_url() == "http://127.0.0.1:1230"
        assert xdist.get_snuba_url() == "http://127.0.0.1:1230"


def test_parallel_worker_index_4() -> None:
    with mock.patch.dict(os.environ), _role("worker", 4):
        os.environ.pop("XDIST_PER_WORKER_SNUBA", None)
        assert workers.parallel_worker_index() == 4
        assert workers.get_redis_db() == 13
        assert xdist.get_redis_db() == 13
        assert workers.get_redis_cluster_key_prefix() == "test-gw4:"
        assert xdist.get_redis_cluster_key_prefix() == "test-gw4:"
        assert workers.get_kafka_topic("test-consumer") == "test-consumer-gw4"
        assert xdist.get_kafka_topic("test-consumer") == "test-consumer-gw4"
        assert workers.get_snuba_url() is None
        assert xdist.get_snuba_url() is None
        assert workers.snowflake_id() == 5
        assert xdist.get_snowflake_id() == 5
        os.environ["XDIST_PER_WORKER_SNUBA"] = "1"
        assert workers.get_snuba_url() == "http://127.0.0.1:1234"
        assert xdist.get_snuba_url() == "http://127.0.0.1:1234"


def test_controller_uses_main_slot() -> None:
    with (
        mock.patch.dict(os.environ),
        mock.patch.object(xdist, "_worker_id", None),
        mock.patch.object(xdist, "_worker_num", None),
        _role("controller", None),
    ):
        os.environ["PYTEST_XDIST_WORKER"] = "gw3"
        os.environ["XDIST_PER_WORKER_SNUBA"] = "1"
        _assert_main_slot()


def test_serial_uses_main_slot() -> None:
    with (
        mock.patch.dict(os.environ),
        mock.patch.object(xdist, "_worker_id", None),
        mock.patch.object(xdist, "_worker_num", None),
        _role("serial", None),
    ):
        os.environ["XDIST_PER_WORKER_SNUBA"] = "1"
        _assert_main_slot()


def test_xdist_gw3_when_parallel_inactive() -> None:
    with (
        mock.patch("pytest_parallel.api.current_run", return_value=None),
        mock.patch("pytest_parallel.api.current_worker", return_value=None),
        mock.patch.object(xdist, "_worker_id", "gw3"),
        mock.patch.object(xdist, "_worker_num", 3),
    ):
        assert workers.parallel_worker_index() is None
        assert xdist.get_redis_db() == 12
        assert xdist.get_redis_cluster_key_prefix() == "test-gw3:"
        assert xdist.get_kafka_topic("test-consumer") == "test-consumer-gw3"


def test_addopts_parallel_strips_xdist_and_appends_jobs() -> None:
    with mock.patch.dict(os.environ):
        os.environ["SENTRY_TEST_RUNNER"] = "parallel"
        os.environ["PYTEST_ADDOPTS"] = "-n 4 --dist=loadfile --reuse-db"
        os.environ.pop("SENTRY_TEST_WORKERS", None)
        os.environ.pop("XDIST_WORKERS", None)
        pytest_selected.rewrite_pytest_addopts()
        assert os.environ["PYTEST_ADDOPTS"] == (
            "--reuse-db -j 2 --parallel-collection=manifest "
            "--parallel-network=inherit --parallel-drain=60s"
        )


def test_addopts_parallel_prefers_sentry_test_workers() -> None:
    with mock.patch.dict(os.environ):
        os.environ["SENTRY_TEST_RUNNER"] = "parallel"
        os.environ["PYTEST_ADDOPTS"] = "-n 4 --numprocesses 8 --dist=loadfile"
        os.environ["XDIST_WORKERS"] = "9"
        os.environ["SENTRY_TEST_WORKERS"] = "5"
        pytest_selected.rewrite_pytest_addopts()
        assert os.environ["PYTEST_ADDOPTS"] == (
            "-j 5 --parallel-collection=manifest --parallel-network=inherit --parallel-drain=60s"
        )


def test_addopts_serial_strips_xdist_and_appends_serial() -> None:
    with mock.patch.dict(os.environ):
        os.environ["SENTRY_TEST_RUNNER"] = "serial"
        os.environ["PYTEST_ADDOPTS"] = "-n 4 --dist=loadfile --reuse-db"
        pytest_selected.rewrite_pytest_addopts()
        assert os.environ["PYTEST_ADDOPTS"] == "--reuse-db --serial"


def test_addopts_xdist_unchanged() -> None:
    with mock.patch.dict(os.environ):
        os.environ["SENTRY_TEST_RUNNER"] = "xdist"
        original = "-n 4 --dist=loadfile --reuse-db"
        os.environ["PYTEST_ADDOPTS"] = original
        pytest_selected.rewrite_pytest_addopts()
        assert os.environ["PYTEST_ADDOPTS"] == original


def test_addopts_unset_runner_unchanged() -> None:
    with mock.patch.dict(os.environ):
        os.environ.pop("SENTRY_TEST_RUNNER", None)
        original = "-n 4 --dist=loadfile"
        os.environ["PYTEST_ADDOPTS"] = original
        pytest_selected.rewrite_pytest_addopts()
        assert os.environ["PYTEST_ADDOPTS"] == original


def test_in_test_environment_parallel_worker_without_xdist() -> None:
    with mock.patch.object(sys, "argv", ["python"]), mock.patch.dict(os.environ):
        os.environ.pop("SENTRY_IN_TEST_ENVIRONMENT", None)
        os.environ.pop("PYTEST_XDIST_WORKER", None)
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
        os.environ.pop("XDIST_PER_WORKER_SNUBA", None)
        assert sentry_plugin.pytest_parallel_max_workers() == 7
        os.environ["XDIST_PER_WORKER_SNUBA"] = "1"
        assert sentry_plugin.pytest_parallel_max_workers() == 7


def test_parallel_hooks_registered(request: pytest.FixtureRequest) -> None:
    for name in ("pytest_parallel_max_workers", "pytest_parallel_worker_env"):
        hook = getattr(request.config.hook, name)
        assert any(
            impl.function.__module__ == "sentry.testutils.pytest.sentry"
            for impl in hook.get_hookimpls()
        )


def test_database_suffix_fixture_replaces_pytest_django(request: pytest.FixtureRequest) -> None:
    defs = request.session._fixturemanager.getfixturedefs(
        "django_db_modify_db_settings_xdist_suffix", request.node
    )
    assert defs is not None
    assert defs[-1].func.__module__ == "sentry.testutils.pytest.sentry"


def test_database_suffix_parallel_worker() -> None:
    assert workers.database_suffix("parallel", 4, "gw9") == "gw4"


def test_database_suffix_parallel_controller() -> None:
    assert workers.database_suffix("parallel", None, "gw9") is None


def test_database_suffix_xdist_workerid() -> None:
    assert workers.database_suffix("xdist", 4, "gw3") == "gw3"


def test_effective_database_names_use_one_runner_suffix(request: pytest.FixtureRequest) -> None:
    from django.conf import settings

    aliases = ("default", "control", "secondary")
    original_names = {alias: settings.DATABASES[alias]["NAME"] for alias in aliases}
    request.getfixturevalue("django_db_modify_db_settings")
    workerinput = getattr(request.config, "workerinput", None)
    workerid = workerinput.get("workerid") if isinstance(workerinput, dict) else None
    suffix = workers.database_suffix(
        os.environ.get("SENTRY_TEST_RUNNER", "xdist"),
        workers.parallel_worker_index(),
        workerid if isinstance(workerid, str) else None,
    )

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
        os.environ.pop("PYTEST_XDIST_TESTRUNUID", None)
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


def test_cell_name_keeps_xdist_run_uid_fallback() -> None:
    with (
        mock.patch.dict(os.environ, {"PYTEST_XDIST_TESTRUNUID": "legacy-run"}),
        _role("serial", None),
    ):
        assert sentry_plugin._cell_seed() == "legacy-run"


def test_worker_env_removes_parent_process_state_from_dict() -> None:
    with mock.patch.dict(os.environ):
        os.environ["DJANGO_SETTINGS_MODULE"] = "sentinel.settings"
        os.environ["PYTEST_XDIST_WORKER"] = "gw1"
        env = {
            "DJANGO_SETTINGS_MODULE": "sentry.conf.server",
            "PYTEST_XDIST_WORKER": "gw1",
            "PYTEST_XDIST_TESTRUNUID": "abc",
            "PYTEST_SHARD_PARTS": "parent-parts.json",
            "KEEP": "1",
        }
        sentry_plugin.pytest_parallel_worker_env(env, 3)
        assert "DJANGO_SETTINGS_MODULE" not in env
        assert "PYTEST_XDIST_WORKER" not in env
        assert "PYTEST_XDIST_TESTRUNUID" not in env
        assert "PYTEST_SHARD_PARTS" not in env
        assert env["KEEP"] == "1"
        assert os.environ["DJANGO_SETTINGS_MODULE"] == "sentinel.settings"
        assert os.environ["PYTEST_XDIST_WORKER"] == "gw1"


def test_service_lock_second_acquire_raises(tmp_path: Path) -> None:
    path = tmp_path / "sentry-service.lock"
    held = workers.acquire_service_lock(path)
    try:
        with pytest.raises(BlockingIOError):
            workers.acquire_service_lock(path)
    finally:
        os.close(held)
