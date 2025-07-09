import uuid
from unittest import mock

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic
from sentry.replays.usecases.ingest.event_logger import (
    emit_click_events,
    emit_trace_items_to_eap,
    gen_rage_clicks,
)
from sentry.replays.usecases.ingest.event_parser import ClickEvent, ParsedEventMeta


def test_gen_rage_clicks():
    # No clicks.
    meta = ParsedEventMeta([], [], [], [], [], [])
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


def test_emit_click_events_environment_handling():
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


def test_emit_trace_items_to_eap():
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

    with mock.patch("arroyo.backends.kafka.consumer.KafkaProducer.produce") as producer:
        emit_trace_items_to_eap(trace_items)

        assert producer.called
        assert producer.call_args[0][0].name == Topic.SNUBA_ITEMS.value
        assert producer.call_args[0][1].key is None
        assert producer.call_args[0][1].headers == []
        assert isinstance(producer.call_args[0][1].value, bytes)
