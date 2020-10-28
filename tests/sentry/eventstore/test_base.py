from __future__ import absolute_import

import logging
from sentry.utils.compat import mock
import pytest
import six

from sentry import eventstore
from sentry.eventstore.models import Event
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.eventstore.base import EventStorage

from sentry.utils.samples import load_data


class EventStorageTest(TestCase):
    def setUp(self):
        self.eventstorage = EventStorage()

    def test_minimal_columns(self):
        assert len(self.eventstorage.minimal_columns) == 4

    def test_bind_nodes(self):
        """
        Test that bind_nodes populates _node_data
        """
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": min_ago, "user": {"id": u"user1"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "timestamp": min_ago, "user": {"id": u"user2"}},
            project_id=self.project.id,
        )

        event = Event(project_id=self.project.id, event_id="a" * 32)
        event2 = Event(project_id=self.project.id, event_id="b" * 32)
        assert event.data._node_data is None
        self.eventstorage.bind_nodes([event, event2], "data")
        assert event.data._node_data is not None
        assert event.data["user"]["id"] == u"user1"


class ServiceDelegationTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(ServiceDelegationTest, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.two_min_ago = iso_format(before_now(minutes=2))
        self.project = self.create_project()

        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group1"],
                "timestamp": self.two_min_ago,
                "tags": {"foo": "1"},
            },
            project_id=self.project.id,
        )

        event_data = load_data("transaction")
        event_data["timestamp"] = iso_format(before_now(minutes=1))
        event_data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=1))
        event_data["event_id"] = "b" * 32

        self.transaction_event = self.store_event(data=event_data, project_id=self.project.id)

    @pytest.mark.skip(reason="There is no longer a difference in underlying dataset.")
    def test_logs_differences(self):
        logger = logging.getLogger("sentry.eventstore")

        with mock.patch.object(logger, "info") as mock_logger:
            # No differences to log
            _filter = eventstore.Filter(project_ids=[self.project.id])
            eventstore.get_events(filter=_filter)
            eventstore.get_event_by_id(self.project.id, "a" * 32)
            assert mock_logger.call_count == 0

            # Here we expect a difference since the original implementation handles type as a tag
            event = eventstore.get_event_by_id(self.project.id, "a" * 32)
            _filter = eventstore.Filter(
                project_ids=[self.project.id], conditions=[["type", "=", "transaction"]]
            )
            eventstore.get_next_event_id(event, _filter)
            assert mock_logger.call_count == 1
            mock_logger.assert_called_with(
                "discover.result-mismatch",
                extra={
                    "snuba_result": None,
                    "snuba_discover_result": (six.text_type(self.project.id), "b" * 32),
                    "method": "get_next_event_id",
                    "event_id": event.event_id,
                    "filter_keys": _filter.filter_keys,
                    "conditions": _filter.conditions,
                },
            )
