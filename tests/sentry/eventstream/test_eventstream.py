import logging
import time
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest
from django.conf import settings
from snuba_sdk import Column, Condition, Entity, Op, Query, Request

from sentry import nodestore
from sentry.event_manager import EventManager
from sentry.eventstore.models import Event
from sentry.eventstream.base import EventStreamEventType
from sentry.eventstream.kafka.backend import KafkaEventStream
from sentry.eventstream.snuba import SnubaEventStream, SnubaProtocolEventStream
from sentry.issues.occurrence_consumer import process_event_and_issue_occurrence
from sentry.receivers import create_default_projects
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json, snuba
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin


@region_silo_test
class SnubaEventStreamTest(TestCase, SnubaTestCase, OccurrenceTestMixin):
    @pytest.fixture(autouse=True)
    def patch_get_producer(self):
        self.kafka_eventstream = KafkaEventStream()
        self.producer_mock = Mock()

        with patch.object(KafkaEventStream, "get_producer", return_value=self.producer_mock):
            yield

    def __build_event(self, timestamp):
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

    def __build_transaction_event(self):
        manager = EventManager(load_data("transaction"))
        manager.normalize()
        return manager.save(self.project.id)

    def __produce_event(self, *insert_args, **insert_kwargs):
        event_type = self.kafka_eventstream._get_event_type(insert_kwargs["event"])

        # pass arguments on to Kafka EventManager
        self.kafka_eventstream.insert(*insert_args, **insert_kwargs)

        producer = self.producer_mock

        produce_args, produce_kwargs = list(producer.produce.call_args)
        assert not produce_args
        if event_type == EventStreamEventType.Transaction:
            assert produce_kwargs["topic"] == settings.KAFKA_TRANSACTIONS
            assert produce_kwargs["key"] is None
        elif event_type == EventStreamEventType.Generic:
            assert produce_kwargs["topic"] == settings.KAFKA_EVENTSTREAM_GENERIC
            assert produce_kwargs["key"] is None
        else:
            assert produce_kwargs["topic"] == settings.KAFKA_EVENTS
            assert produce_kwargs["key"] == str(self.project.id).encode("utf-8")

        version, type_, payload1, payload2 = json.loads(produce_kwargs["value"])
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

    def __produce_payload(self, *insert_args, **insert_kwargs):
        # pass arguments on to Kafka EventManager
        self.kafka_eventstream.insert(*insert_args, **insert_kwargs)

        producer = self.producer_mock

        produce_args, produce_kwargs = list(producer.produce.call_args)
        assert not produce_args

        version, type_, payload1, payload2 = json.loads(produce_kwargs["value"])

        # only return headers and body payload
        return produce_kwargs["headers"], payload2

    @patch("sentry.eventstream.backend.insert", autospec=True)
    def test(self, mock_eventstream_insert):
        now = datetime.utcnow()

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
    def test_issueless(self, mock_eventstream_insert):
        now = datetime.utcnow()
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
    def test_multiple_groups(self, mock_eventstream_insert):
        now = datetime.utcnow()
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
    def test_invalid_groupevent_passed(self, logger):
        event = self.__build_transaction_event()
        event.group_id = None
        event.group_ids = [self.group.id]
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
    def test_groupevent_occurrence_passed(self, mock_eventstream_insert):
        now = datetime.utcnow()
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
        version, type_, payload1, payload2 = json.loads(produce_kwargs["value"])
        assert produce_kwargs["topic"] == settings.KAFKA_EVENTSTREAM_GENERIC
        assert produce_kwargs["key"] is None
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

        query = Query(
            match=Entity(EntityKey.IssuePlatform.value),
            select=[Column("event_id"), Column("group_id"), Column("occurrence_id")],
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
    def test_error_queue(self, mock_eventstream_insert):
        now = datetime.utcnow()

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

        assert ("queue", b"post_process_errors") in headers
        assert "occurrence_id" not in dict(headers)
        assert body["queue"] == "post_process_errors"

    @patch("sentry.eventstream.backend.insert", autospec=True)
    def test_transaction_queue(self, mock_eventstream_insert):
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

        assert ("queue", b"post_process_transactions") in headers
        assert "occurrence_id" not in dict(headers)
        assert body["queue"] == "post_process_transactions"

    @patch("sentry.eventstream.backend.insert", autospec=True)
    def test_issue_platform_queue(self, mock_eventstream_insert):
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

        assert ("queue", b"post_process_issue_platform") in headers
        assert ("occurrence_id", bytes(group_event.occurrence.id, encoding="utf-8")) in headers
        assert body["queue"] == "post_process_issue_platform"

    def test_insert_generic_event_contexts(self):
        create_default_projects()
        es = SnubaProtocolEventStream()

        profile_message = load_data("generic-event-profiling")
        geo_interface = {"city": "San Francisco", "country_code": "US", "region": "California"}
        event_data = profile_message["event"]
        event_data["user"] = {"geo": geo_interface}

        project_id = event_data.get("project_id", self.project.id)
        event_data["timestamp"] = datetime.utcnow().isoformat()

        occurrence, group_info = process_event_and_issue_occurrence(
            self.build_occurrence_data(event_id=event_data["event_id"], project_id=project_id),
            event_data,
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
            assert contexts_after_processing == {**{"geo": geo_interface}}
