import subprocess
import time
from typing import Generator
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
