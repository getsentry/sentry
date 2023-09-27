import subprocess
import time
from typing import Generator, List
from unittest import mock

import pytest

from tools.devservices_healthcheck import HealthcheckError, check_health, run_with_retries


@pytest.fixture(autouse=True)
def no_sleep() -> Generator[None, None, None]:
    with mock.patch.object(time, "sleep"):
        yield


@pytest.fixture
def mock_subprocess_run() -> Generator[mock.Mock, None, None]:
    with mock.patch.object(subprocess, "run", autospec=True) as mock_run:
        yield mock_run


def test_run_with_retries_fail() -> None:
    with pytest.raises(HealthcheckError):
        run_with_retries(
            lambda: subprocess.run(("ls", "/tmp/this-does-not-exist"), check=True), 1, 10
        )


def test_run_with_retries_ok() -> None:
    run_with_retries(lambda: subprocess.run("date", check=True), 1, 10)


def test_postgres_not_running(mock_subprocess_run: mock.MagicMock) -> None:
    mock_subprocess_run.return_value.stdout = ""
    mock_subprocess_run.return_value.code = 0

    with pytest.raises(HealthcheckError):
        check_health(["postgres"])
    assert mock_subprocess_run.call_count == 3


def test_postgres_healthcheck_failing(mock_subprocess_run: mock.MagicMock) -> None:
    running = mock.Mock()
    running.stdout = "running\n"
    running.code = 0

    mock_subprocess_run.side_effect = [
        running,
        HealthcheckError("injected error"),
        HealthcheckError("injected error"),
        HealthcheckError("injected error"),
    ]

    with pytest.raises(HealthcheckError):
        check_health(["postgres"])
    assert mock_subprocess_run.call_count == 4


def test_postgres_running(mock_subprocess_run: mock.MagicMock) -> None:
    running = mock.Mock()
    running.stdout = "running\n"
    running.code = 0

    healthcheck = mock.Mock()

    mock_subprocess_run.side_effect = [
        running,
        healthcheck,
    ]

    check_health(["postgres"])
    assert mock_subprocess_run.call_count == 2


def test_kafka_running(mock_subprocess_run: mock.MagicMock) -> None:
    running = mock.Mock()
    running.stdout = "running\n"
    running.code = 0

    healthcheck = mock.Mock()

    def run(
        cmd_args: List[str], capture_output: bool = False, text: bool = False, check: bool = False
    ) -> mock.Mock:
        if cmd_args == (
            "docker",
            "container",
            "inspect",
            "-f",
            "{{.State.Status}}",
            "sentry_per",
        ):
            return running
        elif cmd_args == (
            "docker",
            "container",
            "inspect",
            "-f",
            "{{.State.Status}}",
            "sentry_kafka",
        ):
            return running
        elif cmd_args == (
            "docker",
            "exec",
            "sentry_kafka",
            "kafka-topics",
            "--bootstrap-server",
            "127.0.0.1:9092",
            "--list",
        ):
            return healthcheck
        raise AssertionError(f"unexpected command '{cmd_args}'")

    mock_subprocess_run.side_effect = run

    check_health(["kafka"])
    assert mock_subprocess_run.call_count == 2
