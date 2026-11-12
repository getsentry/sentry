import io
import os
import signal
import subprocess
from pathlib import Path
from unittest import mock

from confluent_kafka import KafkaError, KafkaException

import sentry.eventstream.kafka  # noqa: F401  # registers the backend subclasses
from sentry.eventstream.base import EventStream
from sentry.runner.commands import devserver
from sentry.utils.imports import import_string


def _backends(cls: type[EventStream]) -> set[type[EventStream]]:
    return {cls}.union(*(_backends(sub) for sub in cls.__subclasses__()))


def test_post_process_forwarder_eventstreams_match_backends() -> None:
    needs_forwarder = {
        cls
        for cls in _backends(EventStream)
        if cls.requires_post_process_forwarder(object.__new__(cls))
    }
    assert needs_forwarder == {
        import_string(path) for path in devserver._POST_PROCESS_FORWARDER_EVENTSTREAMS
    }


@mock.patch("time.sleep")
@mock.patch.object(devserver, "create_topics")
@mock.patch.object(devserver, "AdminClient")
@mock.patch.object(devserver, "list_topics", return_value=["events", "ingest-occurrences"])
def test_create_kafka_topics_waits_for_kafka(
    _list_topics: mock.MagicMock,
    admin_client: mock.MagicMock,
    create_topics: mock.MagicMock,
    _sleep: mock.MagicMock,
    tmp_path: Path,
) -> None:
    topics_ready = tmp_path / "ready"
    unreachable = KafkaException(KafkaError(KafkaError._TRANSPORT))
    admin_client.return_value.list_topics.side_effect = [unreachable, unreachable, None]

    devserver._create_kafka_topics(topics_ready)

    assert admin_client.call_count == 3
    create_topics.assert_called_once_with("default", ["events", "ingest-occurrences"])
    assert topics_ready.exists()


@mock.patch("os.kill")
@mock.patch.object(devserver, "create_topics", side_effect=RuntimeError("no topics for you"))
@mock.patch.object(devserver, "AdminClient")
@mock.patch.object(devserver, "list_topics", return_value=["events"])
def test_create_kafka_topics_failure_stops_devserver(
    _list_topics: mock.MagicMock,
    _admin_client: mock.MagicMock,
    _create_topics: mock.MagicMock,
    kill: mock.MagicMock,
    tmp_path: Path,
) -> None:
    topics_ready = tmp_path / "ready"
    output = io.StringIO()

    devserver._create_kafka_topics_or_stop(topics_ready, output)

    assert "RuntimeError: no topics for you" in output.getvalue()
    kill.assert_called_once_with(os.getpid(), signal.SIGTERM)
    assert not topics_ready.exists()


def test_consumers_start_after_kafka_topics(tmp_path: Path) -> None:
    topics_ready = tmp_path / "topics ready"
    command = devserver._after_kafka_topics(topics_ready, "echo subscribed")
    with subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, text=True) as consumer:
        try:
            consumer.wait(timeout=0.5)
        except subprocess.TimeoutExpired:
            pass
        assert consumer.returncode is None

        topics_ready.touch()

        stdout, _ = consumer.communicate(timeout=5)
    assert stdout == "subscribed\n"
