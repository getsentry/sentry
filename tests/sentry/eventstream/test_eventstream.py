import logging
import threading
import time
import uuid
from collections.abc import Generator, MutableSequence
from datetime import datetime, timedelta
from typing import Any, cast
from unittest import mock
from unittest.mock import MagicMock, Mock, patch

import pytest
from arroyo.backends.kafka import FutureTrackingProducer, KafkaPayload, KafkaProducer
from arroyo.backends.kafka import producer as arroyo_producer
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Topic as ArroyoTopic
from django.utils import timezone
from sentry_protos.snuba.v1.request_common_pb2 import TRACE_ITEM_TYPE_OCCURRENCE
from snuba_sdk import Column, Condition, Entity, Op, Query, Request

from sentry import nodestore
from sentry.conf.types.kafka_definition import Topic
from sentry.event_manager import EventManager
from sentry.eventstream.kafka import backend as eventstream_backend
from sentry.eventstream.kafka.backend import KafkaEventStream
from sentry.eventstream.snuba import SnubaEventStream, SnubaProtocolEventStream
from sentry.eventstream.types import EventStreamEventType
from sentry.receivers import create_default_projects
from sentry.services.eventstore.models import Event
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils import arroyo_producer as arroyo_producer_utils
from sentry.utils import json, snuba
from sentry.utils.eap import hex_to_item_id
from sentry.utils.kafka_config import get_topic_definition
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin

EVENTSTREAM_TOPICS = [
    Topic.EVENTS,
    Topic.TRANSACTIONS,
    Topic.EVENTSTREAM_GENERIC,
    Topic.SNUBA_ITEMS,
]


@pytest.fixture
def isolated_eventstream_producers() -> Generator[None]:
    storage = MemoryMessageStorage[KafkaPayload]()
    broker = LocalBroker(storage)
    for topic in EVENTSTREAM_TOPICS:
        real_topic = get_topic_definition(topic)["real_topic_name"]
        broker.create_topic(ArroyoTopic(real_topic), partitions=1)

    def build_local_producer(**_kwargs: Any) -> Any:
        producer = broker.get_producer()
        cast_producer = cast(Any, producer)
        cast_producer.get_config = lambda: {}
        return producer

    with (
        patch.object(eventstream_backend, "_ftp_producers", {}),
        patch.dict(arroyo_producer._pending_futures, clear=True),
        patch.object(
            eventstream_backend,
            "get_arroyo_producer",
            side_effect=build_local_producer,
        ),
    ):
        yield


@override_options({"tasks.producer.eventstream.rollout": 1.0})
def test_future_tracking_producers_are_unique_per_topic_and_shared_per_process(
    isolated_eventstream_producers: None,
) -> None:
    first = KafkaEventStream()
    second = KafkaEventStream()

    first_producers = [first.get_producer(topic) for topic in EVENTSTREAM_TOPICS]
    second_producers = [second.get_producer(topic) for topic in EVENTSTREAM_TOPICS]
    future_tracking_producers = [
        producer for producer in first_producers if isinstance(producer, FutureTrackingProducer)
    ]

    assert len(future_tracking_producers) == len(EVENTSTREAM_TOPICS)
    assert [producer.name for producer in future_tracking_producers] == [
        f"sentry.eventstream.kafka.ftp.{topic.value}" for topic in EVENTSTREAM_TOPICS
    ]
    assert second_producers == first_producers


@override_options({"tasks.producer.eventstream.rollout": 1.0})
def test_concurrent_calls_build_one_future_tracking_producer(
    isolated_eventstream_producers: None,
) -> None:
    eventstream = KafkaEventStream()
    thread_count = 8
    start = threading.Barrier(thread_count)
    original_builder = arroyo_producer_utils.get_future_tracking_producer

    def slow_build(**kwargs: Any) -> FutureTrackingProducer:
        time.sleep(0.05)
        return original_builder(**kwargs)

    producers: list[KafkaProducer | FutureTrackingProducer] = []
    errors: list[BaseException] = []

    def get_producer() -> None:
        start.wait()
        try:
            producers.append(eventstream.get_producer(Topic.EVENTS))
        except BaseException as error:
            errors.append(error)

    with patch.object(eventstream_backend, "get_future_tracking_producer", side_effect=slow_build):
        threads = [threading.Thread(target=get_producer) for _ in range(thread_count)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

    assert errors == []
    assert len(producers) == thread_count
    assert len({id(producer) for producer in producers}) == 1


@override_options({"tasks.producer.eventstream.rollout": 0.0})
def test_disabled_future_tracking_rollout_does_not_register_producers(
    isolated_eventstream_producers: None,
) -> None:
    eventstream = KafkaEventStream()

    producers = [eventstream.get_producer(topic) for topic in EVENTSTREAM_TOPICS]

    assert not any(isinstance(producer, FutureTrackingProducer) for producer in producers)
    assert arroyo_producer._pending_futures == {}


@override_options({"tasks.producer.eventstream.rollout": 1.0})
def test_future_tracking_producer_waits_for_synchronous_send(
    isolated_eventstream_producers: None,
) -> None:
    eventstream = KafkaEventStream()
    producer = eventstream.get_producer(Topic.EVENTS)
    assert isinstance(producer, FutureTrackingProducer)

    with patch.object(producer, "produce", wraps=producer.produce) as produce:
        eventstream._send(project_id=1, _type="insert", extra_data=({},), asynchronous=False)

    produce.assert_called_once()
    assert produce.call_args.kwargs["asynchronous"] is False


class SnubaEventStreamTest(TestCase, SnubaTestCase, OccurrenceTestMixin):
    @pytest.fixture(autouse=True)
    def patch_get_producer(self) -> Generator[None]:
        self.kafka_eventstream = KafkaEventStream()
        self.producer_mock = Mock()

        with patch.object(KafkaEventStream, "get_producer", return_value=self.producer_mock):
            yield

    def __build_event(self, timestamp: datetime) -> Event:
        raw_event = {
            "event_id": "a" * 32,
            "message": "foo",
            "timestamp": time.mktime(timestamp.timetuple()),
            "level": logging.ERROR,
            "logger": "default",
            "tags": [],
        }
        manager = EventManager(raw_event)
        manager.normalize()
        return manager.save(self.project.id)

    def __build_transaction_event(self) -> Event:
        manager = EventManager(load_data("transaction"))
        manager.normalize()
        return manager.save(self.project.id)

    def __produce_event(self, *insert_args: Any, **insert_kwargs: Any) -> None:
        event_type = self.kafka_eventstream._get_event_type(insert_kwargs["event"])

        # pass arguments on to Kafka EventManager
        self.kafka_eventstream.insert(*insert_args, **insert_kwargs)

        producer = self.producer_mock

        produce_args, produce_kwargs = list(producer.produce.call_args)
        assert not produce_args
        if event_type == EventStreamEventType.Transaction:
            assert produce_kwargs["destination"].name == "transactions"
            assert produce_kwargs["payload"].key is None
        elif event_type == EventStreamEventType.Generic:
            assert produce_kwargs["destination"].name == "generic-events"
            assert produce_kwargs["payload"].key is None
        else:
            assert produce_kwargs["destination"].name == "events"
            assert produce_kwargs["payload"].key == str(self.project.id).encode("utf-8")

        version, type_, payload1, payload2 = json.loads(produce_kwargs["payload"].value)
        assert version == 2
        assert type_ == "insert"

        # insert what would have been the Kafka payload directly
        # into Snuba, expect an HTTP 200 and for the event to now exist
        snuba_eventstream = SnubaEventStream()
        snuba_eventstream._send(
            self.project.id,
            "insert",
            (payload1, payload2),
            event_type=event_type,
        )

    def __produce_payload(
        self, *insert_args: Any, **insert_kwargs: Any
    ) -> tuple[MutableSequence[tuple[str, bytes]], Any]:
        # pass arguments on to Kafka EventManager
        self.kafka_eventstream.insert(*insert_args, **insert_kwargs)

        producer = self.producer_mock

        produce_args, produce_kwargs = list(producer.produce.call_args)
        assert not produce_args

        version, type_, payload1, payload2 = json.loads(produce_kwargs["payload"].value)

        # only return headers and body payload
        return produce_kwargs["payload"].headers, payload2

    def test_init_options(self) -> None:
        # options in the constructor shouldn't cause errors
        stream = KafkaEventStream(foo="bar")
        assert stream

    @patch("sentry.eventstream.backend.insert", autospec=True)
    def test(self, mock_eventstream_insert: MagicMock) -> None:
        now = timezone.now()

        event = self.__build_event(now)

        # verify eventstream was called by EventManager
        insert_args, insert_kwargs = list(mock_eventstream_insert.call_args)
        assert not insert_args

        group_state = {
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
        }

        assert insert_kwargs == {
            "event": event,
            **group_state,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
            "group_states": [{"id": event.groups[0].id, **group_state}],
        }

        self.__produce_event(*insert_args, **insert_kwargs)
        assert (
            snuba.query(
                start=now - timedelta(days=1),
                end=now + timedelta(days=1),
                groupby=["project_id"],
                filter_keys={"project_id": [self.project.id]},
                tenant_ids={"organization_id": 1, "referrer": "r"},
            ).get(self.project.id, 0)
            == 1
        )

    @patch("sentry.eventstream.backend.insert", autospec=True)
    def test_issueless(self, mock_eventstream_insert: MagicMock) -> None:
        now = timezone.now()
        event = self.__build_transaction_event()
        event.group_id = None
        insert_args = ()
        insert_kwargs = {
            "event": event,
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
        }

        self.__produce_event(*insert_args, **insert_kwargs)
        result = snuba.raw_query(
            dataset=Dataset.Transactions,
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            selected_columns=["event_id"],
            groupby=None,
            filter_keys={"project_id": [self.project.id], "event_id": [event.event_id]},
            tenant_ids={"organization_id": 1, "referrer": "r"},
        )
        assert len(result["data"]) == 1

    @patch("sentry.eventstream.backend.insert", autospec=True)
    def test_multiple_groups(self, mock_eventstream_insert: MagicMock) -> None:
        now = timezone.now()
        event = self.__build_transaction_event()
        event.group_id = None
        event.groups = [self.group]
        insert_args = ()
        group_state = {
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
        }
        insert_kwargs = {
            "event": event,
            **group_state,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
            "group_states": [{"id": event.groups[0].id, **group_state}],
        }

        self.__produce_event(*insert_args, **insert_kwargs)
        result = snuba.raw_query(
            dataset=Dataset.Transactions,
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            selected_columns=["event_id", "group_ids"],
            groupby=None,
            filter_keys={"project_id": [self.project.id], "event_id": [event.event_id]},
            tenant_ids={"organization_id": 1, "referrer": "r"},
        )
        assert len(result["data"]) == 1
        assert result["data"][0]["group_ids"] == [self.group.id]

    @patch("sentry.eventstream.snuba.logger")
    def test_invalid_groupevent_passed(self, logger: MagicMock) -> None:
        event = self.__build_transaction_event()
        event.group_id = None
        event.groups = [self.group]
        insert_args = ()
        insert_kwargs = {
            "event": event.for_group(self.group),
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
        }
        self.kafka_eventstream.insert(*insert_args, **insert_kwargs)
        assert not self.producer_mock.produce.called
        logger.error.assert_called_with(
            "`GroupEvent` passed to `EventStream.insert`. `GroupEvent` may only be passed when "
            "associated with an `IssueOccurrence`",
        )

    @patch("sentry.eventstream.backend.insert", autospec=True)
    def test_groupevent_occurrence_passed(self, mock_eventstream_insert: MagicMock) -> None:
        now = timezone.now()
        event = self.__build_transaction_event()
        event.group_id = self.group.id
        group_event = event.for_group(self.group)
        group_event.occurrence = self.build_occurrence()

        insert_args = ()
        insert_kwargs = {
            "event": group_event,
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
            "group_states": [],
        }
        self.__produce_event(*insert_args, **insert_kwargs)
        producer = self.producer_mock
        produce_args, produce_kwargs = list(producer.produce.call_args)
        version, type_, payload1, payload2 = json.loads(produce_kwargs["payload"].value)
        assert produce_kwargs["destination"].name == "generic-events"
        assert produce_kwargs["payload"].key is None
        assert version == 2
        assert type_ == "insert"
        occurrence_data = group_event.occurrence.to_dict()
        occurrence_data_no_evidence = {
            k: v
            for k, v in occurrence_data.items()
            if k not in {"evidence_data", "evidence_display"}
        }
        assert payload1["occurrence_id"] == occurrence_data["id"]
        assert payload1["occurrence_data"] == occurrence_data_no_evidence
        assert payload1["group_id"] == self.group.id
        assert payload1["group_first_seen"] == json.datetime_to_str(self.group.first_seen)

        query = Query(
            match=Entity(EntityKey.IssuePlatform.value),
            select=[
                Column("event_id"),
                Column("group_id"),
                Column("occurrence_id"),
            ],
            where=[
                Condition(Column("timestamp"), Op.GTE, now - timedelta(days=1)),
                Condition(Column("timestamp"), Op.LT, now + timedelta(days=1)),
                Condition(Column("project_id"), Op.EQ, self.project.id),
            ],
        )
        request = Request(
            dataset=Dataset.IssuePlatform.value,
            app_id="test_eventstream",
            query=query,
            tenant_ids={"referrer": "test_eventstream", "organization_id": 1},
        )
        result = snuba.raw_snql_query(
            request,
            referrer="test_eventstream",
        )

        assert len(result["data"]) == 1
        assert result["data"][0]["event_id"] == event.event_id
        assert result["data"][0]["group_id"] == self.group.id
        assert result["data"][0]["occurrence_id"] == group_event.occurrence.id

    @patch("sentry.eventstream.backend.insert", autospec=True)
    def test_error(self, mock_eventstream_insert: MagicMock) -> None:
        now = timezone.now()

        event = self.__build_event(now)

        # verify eventstream was called by EventManager
        insert_args, insert_kwargs = list(mock_eventstream_insert.call_args)
        assert not insert_args

        group_state = {
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
        }

        assert insert_kwargs == {
            "event": event,
            **group_state,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
            "group_states": [{"id": event.groups[0].id, **group_state}],
        }

        headers, body = self.__produce_payload(*insert_args, **insert_kwargs)

        assert "occurrence_id" not in dict(headers)
        assert body

    @patch("sentry.eventstream.backend.insert", autospec=True)
    def test_transaction(self, mock_eventstream_insert: MagicMock) -> None:
        event = self.__build_transaction_event()
        event.group_id = None
        event.groups = [self.group]
        insert_args = ()
        group_state = {
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
        }
        insert_kwargs = {
            "event": event,
            **group_state,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
            "group_states": [{"id": event.groups[0].id, **group_state}],
        }

        headers, body = self.__produce_payload(*insert_args, **insert_kwargs)

        assert "occurrence_id" not in dict(headers)
        assert body

    @patch("sentry.eventstream.backend.insert", autospec=True)
    def test_issue_platform(self, mock_eventstream_insert: MagicMock) -> None:
        event = self.__build_transaction_event()
        event.group_id = None
        event.groups = [self.group]
        group_event = event.for_group(self.group)
        group_event.occurrence = self.build_occurrence()

        insert_args = ()
        group_state = {
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
        }
        insert_kwargs = {
            "event": group_event,
            **group_state,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
            "group_states": [{"id": event.groups[0].id, **group_state}],
        }

        headers, body = self.__produce_payload(*insert_args, **insert_kwargs)
        assert ("occurrence_id", group_event.occurrence.id.encode()) in headers
        assert body

    def test_insert_generic_event_contexts(self) -> None:
        create_default_projects()
        es = SnubaProtocolEventStream()

        profile_message = load_data("generic-event-profiling")
        geo_interface = {"city": "San Francisco", "country_code": "US", "region": "California"}
        event_data = {
            **profile_message["event"],
            "user": {"geo": geo_interface},
            "timestamp": timezone.now().isoformat(),
        }

        project_id = event_data.get("project_id", self.project.id)

        occurrence, group_info = self.process_occurrence(
            event_id=event_data["event_id"],
            project_id=project_id,
            event_data=event_data,
        )
        assert group_info is not None

        event = Event(
            event_id=occurrence.event_id,
            project_id=project_id,
            data=nodestore.backend.get(Event.generate_node_id(project_id, occurrence.event_id)),
        )
        group_event = event.for_group(group_info.group)
        group_event.occurrence = occurrence

        with patch.object(es, "_send") as send:
            es.insert(
                group_event,
                True,
                True,
                False,
                "",
                0.0,
            )
            send_extra_data_data = send.call_args.kwargs["extra_data"][0]["data"]
            assert "contexts" in send_extra_data_data
            contexts_after_processing = send_extra_data_data["contexts"]
            assert contexts_after_processing == {**{"geo": geo_interface, "trace": mock.ANY}}

    def test_event_forwarding_to_items(self) -> None:
        create_default_projects()
        es = self.kafka_eventstream

        # Prepare a generic event with a span item
        profile_message = load_data("generic-event-profiling")
        event_data = {
            **profile_message["event"],
            "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
            "timestamp": timezone.now().isoformat(),
        }
        project_id = event_data.get("project_id", self.project.id)

        occurrence, group_info = self.process_occurrence(
            event_id=event_data["event_id"],
            project_id=project_id,
            event_data=event_data,
        )
        assert group_info is not None

        event = Event(
            event_id=occurrence.event_id,
            project_id=project_id,
            data=nodestore.backend.get(Event.generate_node_id(project_id, occurrence.event_id)),
        )
        group_event = event.for_group(group_info.group)
        group_event.occurrence = occurrence

        with self.options({"eventstream.eap_forwarding_rate": 1.0}):
            with patch.object(es, "_send_item") as send:
                es.insert(
                    group_event,
                    is_new=True,
                    is_regression=True,
                    is_new_group_environment=False,
                    primary_hash="",
                    skip_consume=False,
                    received_timestamp=event_data["timestamp"],
                )
                send.assert_called_once()

                trace_item = send.call_args[0][0]

                assert trace_item.item_id == hex_to_item_id(event.event_id)
                assert trace_item.item_type == TRACE_ITEM_TYPE_OCCURRENCE
                assert trace_item.trace_id == event_data["contexts"]["trace"]["trace_id"]
                assert trace_item.project_id == event.project_id
                assert trace_item.organization_id == event.project.organization_id
                assert trace_item.retention_days == 90
                assert trace_item.attributes["group_id"].int_value == group_info.group.id

    def test_snuba_event_stream_forwarding_to_items(self) -> None:
        create_default_projects()
        es = SnubaEventStream()

        # Prepare a generic event with a span item
        profile_message = load_data("generic-event-profiling")
        event_data = {
            **profile_message["event"],
            "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
            "timestamp": timezone.now().isoformat(),
        }
        project_id = event_data.get("project_id", self.project.id)

        occurrence, group_info = self.process_occurrence(
            event_id=event_data["event_id"],
            project_id=project_id,
            event_data=event_data,
        )
        assert group_info is not None

        event = Event(
            event_id=occurrence.event_id,
            project_id=project_id,
            data=nodestore.backend.get(Event.generate_node_id(project_id, occurrence.event_id)),
        )
        group_event = event.for_group(group_info.group)
        group_event.occurrence = occurrence

        with self.options({"eventstream.eap_forwarding_rate": 1.0}):
            # Mock both _send and _send_item to avoid schema validation and verify EAP forwarding
            with patch.object(es, "_send"), patch.object(es, "_send_item") as mock_send_item:
                es.insert(
                    group_event,
                    is_new=True,
                    is_regression=True,
                    is_new_group_environment=False,
                    primary_hash="",
                    skip_consume=False,
                    received_timestamp=event_data["timestamp"],
                )
                mock_send_item.assert_called_once()

                trace_item = mock_send_item.call_args[0][0]
                assert trace_item.item_id == hex_to_item_id(event.event_id)
                assert trace_item.item_type == TRACE_ITEM_TYPE_OCCURRENCE
                assert trace_item.trace_id == event_data["contexts"]["trace"]["trace_id"]
                assert trace_item.project_id == event.project_id
                assert trace_item.organization_id == event.project.organization_id
                assert trace_item.retention_days == 90
                assert trace_item.attributes["group_id"].int_value == group_info.group.id

    def test_snuba_event_stream_no_forwarding_when_rate_zero(self) -> None:
        create_default_projects()
        es = SnubaEventStream()

        # Prepare a generic event with a span item
        profile_message = load_data("generic-event-profiling")
        event_data = {
            **profile_message["event"],
            "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
            "timestamp": timezone.now().isoformat(),
        }
        project_id = event_data.get("project_id", self.project.id)

        occurrence, group_info = self.process_occurrence(
            event_id=event_data["event_id"],
            project_id=project_id,
            event_data=event_data,
        )
        assert group_info is not None

        event = Event(
            event_id=occurrence.event_id,
            project_id=project_id,
            data=nodestore.backend.get(Event.generate_node_id(project_id, occurrence.event_id)),
        )
        group_event = event.for_group(group_info.group)
        group_event.occurrence = occurrence

        with self.options({"eventstream.eap_forwarding_rate": 0.0}):
            with patch.object(es, "_send"), patch.object(es, "_send_item") as mock_send_item:
                es.insert(
                    group_event,
                    is_new=True,
                    is_regression=True,
                    is_new_group_environment=False,
                    primary_hash="",
                    skip_consume=False,
                    received_timestamp=event_data["timestamp"],
                )
                mock_send_item.assert_not_called()
