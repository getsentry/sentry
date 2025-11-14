from typing import int
import uuid
from collections.abc import Callable
from unittest import mock

import pytest
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic
from sentry.replays.usecases.ingest.event_logger import (
    emit_click_events,
    emit_tap_events,
    emit_trace_items_to_eap,
    gen_rage_clicks,
    log_multiclick_events,
    log_rage_click_events,
)
from sentry.replays.usecases.ingest.event_parser import (
    ClickEvent,
    MultiClickEvent,
    ParsedEventMeta,
    TapEvent,
)
from sentry.testutils.thread_leaks.pytest import thread_leak_allowlist


def test_gen_rage_clicks() -> None:
    # No clicks.
    meta = ParsedEventMeta([], [], [], [], [], [], [], [])
    assert len(list(gen_rage_clicks(meta, 1, "1", {"a": "b"}))) == 0

    # Not a rage click and not URL.
    meta.click_events.append(
        ClickEvent("", "", [], "", "", 0, 0, 0, "", "", "", "", "", 0, "", url="")
    )
    assert len(list(gen_rage_clicks(meta, 1, "1", {"a": "b"}))) == 0

    # Rage click but not url.
    meta.click_events.append(
        ClickEvent("", "", [], "", "", 0, 1, 0, "", "", "", "", "", 0, "", url="")
    )
    assert len(list(gen_rage_clicks(meta, 1, "1", {"a": "b"}))) == 0

    # Rage click and url specified.
    meta.click_events.append(
        ClickEvent("", "", [], "", "", 0, 1, 0, "", "", "", "", "", 0, "", url="t")
    )
    assert len(list(gen_rage_clicks(meta, 1, "1", {"a": "b"}))) == 1
    assert len(list(gen_rage_clicks(meta, 1, "1", {}))) == 0
    assert len(list(gen_rage_clicks(meta, 1, "1", None))) == 0


@thread_leak_allowlist(reason="replays", issue=97033)
def test_emit_click_events_environment_handling() -> None:
    click_events = [
        ClickEvent(
            timestamp=1,
            node_id=1,
            tag="div",
            text="test",
            is_dead=False,
            is_rage=False,
            url="http://example.com",
            selector="div",
            component_name="SignUpForm",
            alt="1",
            aria_label="test",
            classes=["class1", "class2"],
            id="id",
            role="button",
            testid="2",
            title="3",
        )
    ]

    with mock.patch("arroyo.backends.kafka.consumer.KafkaProducer.produce") as producer:
        emit_click_events(
            click_events=click_events,
            project_id=1,
            replay_id=uuid.uuid4().hex,
            retention_days=30,
            start_time=1,
            environment="prod",
        )
        assert producer.called
        assert producer.call_args is not None
        assert producer.call_args.args[0].name == "ingest-replay-events"
        assert producer.call_args.args[1].value is not None


@thread_leak_allowlist(reason="replays", issue=97033)
def test_emit_tap_events_environment_handling() -> None:
    tap_events = [
        TapEvent(
            timestamp=1,
            message="add_attachment",
            view_class="androidx.appcompat.widget.AppCompatButton",
            view_id="add_attachment",
        )
    ]

    with mock.patch("arroyo.backends.kafka.consumer.KafkaProducer.produce") as producer:
        emit_tap_events(
            tap_events=tap_events,
            project_id=1,
            replay_id=uuid.uuid4().hex,
            retention_days=30,
            start_time=1,
            environment="prod",
        )
        assert producer.called
        assert producer.call_args is not None
        assert producer.call_args.args[0].name == "ingest-replay-events"
        assert producer.call_args.args[1].value is not None


@thread_leak_allowlist(reason="replays", issue=97033)
@mock.patch("arroyo.backends.kafka.consumer.KafkaProducer.produce")
def test_emit_trace_items_to_eap(producer: mock.MagicMock) -> None:
    timestamp = Timestamp()
    timestamp.FromMilliseconds(1000)

    trace_items = [
        TraceItem(
            organization_id=1,
            project_id=2,
            trace_id=uuid.uuid4().hex,
            item_id=uuid.uuid4().bytes,
            item_type=TraceItemType.TRACE_ITEM_TYPE_REPLAY,
            timestamp=timestamp,
            attributes={},
            client_sample_rate=1.0,
            server_sample_rate=1.0,
            retention_days=90,
            received=timestamp,
        )
    ]

    emit_trace_items_to_eap(trace_items)

    assert producer.called
    assert producer.call_args[0][0].name == Topic.SNUBA_ITEMS.value
    assert producer.call_args[0][1].key is None
    assert producer.call_args[0][1].headers == []
    assert isinstance(producer.call_args[0][1].value, bytes)


@mock.patch("sentry.replays.usecases.ingest.event_logger.logger")
@pytest.mark.parametrize("should_sample,expected_calls", [(lambda: True, 1), (lambda: False, 0)])
def test_log_multiclick_events(
    mock_logger: mock.MagicMock, should_sample: Callable[[], bool], expected_calls: int
) -> None:
    """Test that multiclick events are logged correctly based on sampling."""
    multiclick_events = [
        MultiClickEvent(
            click_event=ClickEvent(
                timestamp=1674291701348,
                node_id=1,
                tag="div",
                text="Click me!",
                is_dead=0,
                is_rage=0,
                url="https://example.com",
                selector="div#test-button.btn.primary",
                component_name="TestComponent",
                alt="",
                aria_label="Test button",
                classes=["btn", "primary"],
                id="test-button",
                role="button",
                testid="test-btn",
                title="Click me",
            ),
            click_count=4,
        )
    ]
    meta = ParsedEventMeta([], [], multiclick_events, [], [], [], [], [])

    log_multiclick_events(
        meta, project_id=1, replay_id="test-replay-id", should_sample=should_sample
    )
    assert mock_logger.info.call_count == expected_calls

    if expected_calls > 0:
        call_args = mock_logger.info.call_args_list[0]
        assert call_args[0][0] == "sentry.replays.slow_click"
        assert call_args[1]["extra"]["click_count"] == 4
        assert call_args[1]["extra"]["project_id"] == 1
        assert call_args[1]["extra"]["replay_id"] == "test-replay-id"


@mock.patch("sentry.replays.usecases.ingest.event_logger.logger")
@pytest.mark.parametrize("should_sample", [lambda: False, lambda: True])
def test_log_multiclick_events_empty(
    mock_logger: mock.MagicMock, should_sample: Callable[[], bool]
) -> None:
    """Test that multiclick events logger is not called if there are no multiclick events."""
    meta = ParsedEventMeta([], [], [], [], [], [], [], [])
    log_multiclick_events(
        meta, project_id=1, replay_id="test-replay-id", should_sample=should_sample
    )
    mock_logger.info.assert_not_called()


@mock.patch("sentry.replays.usecases.ingest.event_logger.logger")
@pytest.mark.parametrize("should_sample,expected_calls", [(lambda: True, 2), (lambda: False, 0)])
def test_log_rage_click_events(
    mock_logger: mock.MagicMock, should_sample: Callable[[], bool], expected_calls: int
) -> None:
    """Test that rage click events are logged correctly based on sampling."""
    click_events = [
        ClickEvent(
            timestamp=1674291701348,
            node_id=1,
            tag="div",
            text="Click me!",
            is_dead=0,
            is_rage=1,  # This is a rage click
            url="https://example.com",
            selector="div#test-button.btn.primary",
            component_name="TestComponent",
            alt="",
            aria_label="Test button",
            classes=["btn", "primary"],
            id="test-button",
            role="button",
            testid="test-btn",
            title="Click me",
        ),
        ClickEvent(
            timestamp=1674291701348,
            node_id=2,
            tag="div",
            text="Rage click me!",
            is_dead=1,
            is_rage=1,  # This is a rage click
            url="https://example.com",
            selector="div#rage-button.btn.danger",
            component_name="RageComponent",
            alt="",
            aria_label="Rage button",
            classes=["btn", "danger"],
            id="rage-button",
            role="button",
            testid="rage-btn",
            title="Rage click me",
        ),
        ClickEvent(
            timestamp=1674291701348,
            node_id=3,
            tag="div",
            text="Regular click",
            is_dead=0,
            is_rage=0,  # This is not a rage click and should not be logged
            url="https://example.com",
            selector="div#regular-button.btn",
            component_name="RegularComponent",
            alt="",
            aria_label="Regular button",
            classes=["btn"],
            id="regular-button",
            role="button",
            testid="regular-btn",
            title="Regular click",
        ),
    ]
    meta = ParsedEventMeta([], click_events, [], [], [], [], [], [])

    log_rage_click_events(
        meta, project_id=1, replay_id="test-replay-id", should_sample=should_sample
    )

    assert mock_logger.info.call_count == expected_calls

    if expected_calls > 0:
        first_call = mock_logger.info.call_args_list[0]
        assert first_call[0][0] == "sentry.replays.slow_click"
        assert first_call[1]["extra"]["is_rage_click"] is True
        assert first_call[1]["extra"]["is_dead_click"] is False
        assert first_call[1]["extra"]["project_id"] == 1
        assert first_call[1]["extra"]["replay_id"] == "test-replay-id"
        assert first_call[1]["extra"]["node_id"] == 1

        second_call = mock_logger.info.call_args_list[1]
        assert second_call[0][0] == "sentry.replays.slow_click"
        assert second_call[1]["extra"]["is_rage_click"] is True
        assert second_call[1]["extra"]["is_dead_click"] is True
        assert second_call[1]["extra"]["project_id"] == 1
        assert second_call[1]["extra"]["replay_id"] == "test-replay-id"
        assert second_call[1]["extra"]["node_id"] == 2
