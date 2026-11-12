import io
import os
import signal
import subprocess
from collections.abc import Generator
from pathlib import Path
from unittest import mock

import pytest
from confluent_kafka import KafkaError, KafkaException

import sentry.eventstream.kafka  # noqa: F401  # registers the backend subclasses
from sentry.eventstream.base import EventStream
from sentry.runner.commands.devserver import (
    _POST_PROCESS_FORWARDER_EVENTSTREAMS,
    _after_kafka_topics,
    _create_kafka_topics_or_stop,
)
from sentry.utils.imports import import_string
from sentry.utils.kafka_config import get_kafka_admin_cluster_options

DEVSERVER = "sentry.runner.commands.devserver"
UNREACHABLE = KafkaException(KafkaError(KafkaError._TRANSPORT))


def _kafka_servers() -> str:
    return get_kafka_admin_cluster_options("default")["bootstrap.servers"]


def _backends(cls: type[EventStream]) -> set[type[EventStream]]:
    return {cls}.union(*(_backends(sub) for sub in cls.__subclasses__()))


def test_post_process_forwarder_eventstreams_match_backends() -> None:
    needs_forwarder = {
        cls
        for cls in _backends(EventStream)
        if cls.requires_post_process_forwarder(object.__new__(cls))
    }
    assert needs_forwarder == {import_string(path) for path in _POST_PROCESS_FORWARDER_EVENTSTREAMS}


@pytest.fixture
def kafka() -> Generator[mock.MagicMock]:
    with (
        mock.patch(f"{DEVSERVER}.list_topics", return_value=["events", "ingest-occurrences"]),
        mock.patch(f"{DEVSERVER}.time.sleep"),
        mock.patch(f"{DEVSERVER}.AdminClient") as admin_client,
    ):
        yield admin_client


@mock.patch("os.kill")
@mock.patch(f"{DEVSERVER}.create_topics")
def test_create_kafka_topics_waits_for_kafka(
    create_topics: mock.MagicMock, kill: mock.MagicMock, kafka: mock.MagicMock, tmp_path: Path
) -> None:
    topics_ready = tmp_path / "ready"
    output = io.StringIO()
    kafka.return_value.list_topics.side_effect = [UNREACHABLE, UNREACHABLE, None]

    _create_kafka_topics_or_stop(topics_ready, output, 1234)

    assert kafka.call_count == 3
    assert output.getvalue() == f"waiting for kafka at {_kafka_servers()}\n"
    create_topics.assert_called_once_with("default", ["events", "ingest-occurrences"])
    assert topics_ready.exists()
    kill.assert_not_called()


@mock.patch("os.kill")
@mock.patch(f"{DEVSERVER}.create_topics")
def test_create_kafka_topics_gives_up_on_kafka(
    create_topics: mock.MagicMock, kill: mock.MagicMock, kafka: mock.MagicMock, tmp_path: Path
) -> None:
    topics_ready = tmp_path / "ready"
    output = io.StringIO()
    kafka.return_value.list_topics.side_effect = UNREACHABLE

    with mock.patch(f"{DEVSERVER}._KAFKA_TIMEOUT_SECONDS", 0):
        _create_kafka_topics_or_stop(topics_ready, output, 1234)

    assert output.getvalue().count(f"waiting for kafka at {_kafka_servers()}") == 1
    assert f"RuntimeError: Kafka at {_kafka_servers()} didn't answer within 0s" in output.getvalue()
    create_topics.assert_not_called()
    kill.assert_called_once_with(1234, signal.SIGTERM)
    assert not topics_ready.exists()


@mock.patch("os.kill")
@mock.patch(f"{DEVSERVER}.create_topics", side_effect=RuntimeError("no topics for you"))
def test_create_kafka_topics_failure_stops_devserver(
    _create_topics: mock.MagicMock, kill: mock.MagicMock, kafka: mock.MagicMock, tmp_path: Path
) -> None:
    topics_ready = tmp_path / "ready"
    output = io.StringIO()

    _create_kafka_topics_or_stop(topics_ready, output, os.getpid())

    assert "RuntimeError: no topics for you" in output.getvalue()
    kill.assert_called_once_with(os.getpid(), signal.SIGTERM)
    assert not topics_ready.exists()


def test_consumers_start_after_kafka_topics(tmp_path: Path) -> None:
    topics_ready = tmp_path / "topics ready"
    command = _after_kafka_topics(topics_ready, "echo subscribed")
    with subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, text=True) as consumer:
        try:
            consumer.wait(timeout=0.5)
        except subprocess.TimeoutExpired:
            pass
        assert consumer.returncode is None

        topics_ready.touch()

        stdout, _ = consumer.communicate(timeout=5)
    assert stdout == "subscribed\n"
