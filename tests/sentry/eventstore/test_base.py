import logging
from unittest import mock

import pytest

from sentry import eventstore
from sentry.eventstore.base import EventStorage
from sentry.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


@region_silo_test
class EventStorageTest(TestCase):
    def setUp(self):
        self.eventstorage = EventStorage()

    def test_minimal_columns(self):
        assert len(self.eventstorage.minimal_columns[Dataset.Events]) == 4
        assert len(self.eventstorage.minimal_columns[Dataset.Transactions]) == 4

    def test_bind_nodes(self):
        """
        Test that bind_nodes populates _node_data
        """
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": min_ago, "user": {"id": "user1"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "timestamp": min_ago, "user": {"id": "user2"}},
            project_id=self.project.id,
        )

        event = Event(project_id=self.project.id, event_id="a" * 32)
        event2 = Event(project_id=self.project.id, event_id="b" * 32)
        assert event.data._node_data is None
        self.eventstorage.bind_nodes([event, event2], "data")
        assert event.data._node_data is not None
        assert event.data["user"]["id"] == "user1"


class ServiceDelegationTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
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
            eventstore.backend.get_events(filter=_filter)
            eventstore.backend.get_event_by_id(self.project.id, "a" * 32)
            assert mock_logger.call_count == 0

            # Here we expect a difference since the original implementation handles type as a tag
            event = eventstore.backend.get_event_by_id(self.project.id, "a" * 32)
            _filter = eventstore.Filter(
                project_ids=[self.project.id], conditions=[["type", "=", "transaction"]]
            )
            eventstore.get_next_event_id(event, _filter)
            assert mock_logger.call_count == 1
            mock_logger.assert_called_with(
                "discover.result-mismatch",
                extra={
                    "snuba_result": None,
                    "snuba_discover_result": (str(self.project.id), "b" * 32),
                    "method": "get_next_event_id",
                    "event_id": event.event_id,
                    "filter_keys": _filter.filter_keys,
                    "conditions": _filter.conditions,
                },
            )
