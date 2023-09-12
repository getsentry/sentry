import subprocess
import time
from unittest import mock

import pytest

from tools.devservices_healthcheck import HealthcheckError, check_health, run_with_retries


@pytest.fixture(autouse=True)
def no_sleep():
    with mock.patch.object(time, "sleep"):
        yield


@pytest.fixture
def mock_subprocess_run():
    with mock.patch.object(subprocess, "run", autospec=True) as mock_run:
        yield mock_run


def test_run_with_retries_fail():
    with pytest.raises(HealthcheckError):
        run_with_retries(
            lambda: subprocess.run(("ls", "/tmp/this-does-not-exist"), check=True), 1, 10
        )


def test_run_with_retries_ok():
    run_with_retries(lambda: subprocess.run(("date"), check=True), 1, 10)


def test_unknown_service():
    with pytest.raises(HealthcheckError):
        check_health(["this service does not exist"])


def test_postgres_not_running(mock_subprocess_run):
    mock_subprocess_run.return_value.stdout = ""
    mock_subprocess_run.return_value.code = 0

    with pytest.raises(HealthcheckError):
        check_health(["postgres"])
    assert mock_subprocess_run.call_count == 3


def test_postgres_healthcheck_failing(mock_subprocess_run):
    running = mock.Mock()
    running.stdout = "'running'\n"
    running.code = 0

    mock_subprocess_run.side_effect = [
        running,
        Exception("injected error"),
    ]

    with pytest.raises(HealthcheckError):
        check_health(["postgres"])
    assert mock_subprocess_run.call_count == 4


def test_postgres_running(mock_subprocess_run):
    running = mock.Mock()
    running.stdout = "'running'\n"
    running.code = 0

    healthcheck = mock.Mock()

    mock_subprocess_run.side_effect = [
        running,
        healthcheck,
    ]

    check_health(["postgres"])
    assert mock_subprocess_run.call_count == 2


def test_kafka_zookeper_running(mock_subprocess_run):
    running = mock.Mock()
    running.stdout = "'running'\n"
    running.code = 0

    healthcheck = mock.Mock()

    def run(cmd_args, capture_output=False, text=False, check=False):
        cmd = " ".join(cmd_args)
        if cmd == "docker container inspect -f '{{.State.Status}}' sentry_zookeeper":
            return running
        elif cmd == "docker container inspect -f '{{.State.Status}}' sentry_kafka":
            return running
        elif (
            cmd == "docker exec sentry_kafka kafka-topics --zookeeper sentry_zookeeper:2181 --list"
            or cmd == "docker exec sentry_kafka kafka-topics --zookeeper 127.0.0.1:2181 --list"
        ):
            return healthcheck
        raise AssertionError("unexpected command")

    mock_subprocess_run.side_effect = run

    check_health(["kafka"])
    assert mock_subprocess_run.call_count == 3
