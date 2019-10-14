from __future__ import absolute_import

import six

from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.eventstore.snuba.backend import SnubaEventStorage
from sentry.eventstore.base import Filter

from sentry.utils.samples import load_data


class SnubaEventStorageTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(SnubaEventStorageTest, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.two_min_ago = iso_format(before_now(minutes=2))
        self.project1 = self.create_project()
        self.project2 = self.create_project()

        self.event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group1"],
                "timestamp": self.two_min_ago,
                "tags": {"foo": "1"},
            },
            project_id=self.project1.id,
        )
        self.event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group1"],
                "timestamp": self.min_ago,
                "tags": {"foo": "1"},
            },
            project_id=self.project2.id,
        )
        self.event3 = self.store_event(
            data={
                "event_id": "c" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group2"],
                "timestamp": self.min_ago,
                "tags": {"foo": "1"},
            },
            project_id=self.project2.id,
        )

        event_data = load_data("transaction")
        event_data["timestamp"] = self.min_ago
        event_data["event_id"] = "d" * 32

        self.transaction_event = self.store_event(data=event_data, project_id=self.project2.id)

        self.eventstore = SnubaEventStorage()

    def test_get_events(self):
        events = self.eventstore.get_events(
            filter=Filter(project_ids=[self.project1.id, self.project2.id])
        )
        assert len(events) == 4
        # Default sort is timestamp desc, event_id desc
        assert events[0].id == "d" * 32
        assert events[1].id == "c" * 32
        assert events[2].id == "b" * 32
        assert events[3].id == "a" * 32

        # No events found
        project = self.create_project()
        events = self.eventstore.get_events(filter=Filter(project_ids=[project.id]))
        assert events == []

    def test_get_event_by_id(self):
        # Get event with default columns
        event = self.eventstore.get_event_by_id(self.project1.id, "a" * 32)

        assert event.id == "a" * 32
        assert event.event_id == "a" * 32
        assert event.project_id == self.project1.id
        assert len(event.snuba_data.keys()) == 4

        # Get all columns
        event = self.eventstore.get_event_by_id(
            self.project2.id, "b" * 32, self.eventstore.full_columns
        )
        assert event.id == "b" * 32
        assert event.event_id == "b" * 32
        assert event.project_id == self.project2.id
        assert len(event.snuba_data.keys()) == 17

        # Get non existent event
        event = self.eventstore.get_event_by_id(self.project2.id, "e" * 32)
        assert event is None

    def test_get_next_prev_event_id(self):
        event = self.eventstore.get_event_by_id(self.project2.id, "b" * 32)

        filter = Filter(project_ids=[self.project1.id, self.project2.id])

        prev_event = self.eventstore.get_prev_event_id(event, filter=filter)

        next_event = self.eventstore.get_next_event_id(event, filter=filter)

        assert prev_event == (six.text_type(self.project1.id), "a" * 32)

        # Events with the same timestamp are sorted by event_id
        assert next_event == (six.text_type(self.project2.id), "c" * 32)

        # Returns None if no event
        assert self.eventstore.get_prev_event_id(None, filter=filter) is None
        assert self.eventstore.get_next_event_id(None, filter=filter) is None

    def test_get_transaction_event_by_id(self):
        event = self.eventstore.get_event_by_id(self.project2.id, self.transaction_event.event_id)

        assert event.id == "d" * 32
        assert event.get_event_type() == "transaction"
        assert event.project_id == self.project2.id
