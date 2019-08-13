from __future__ import absolute_import

import six
from datetime import timedelta
from django.utils import timezone

from sentry.testutils import TestCase, SnubaTestCase
from sentry.eventstore.snuba.backend import SnubaEventStorage


class SnubaEventStorageTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(SnubaEventStorageTest, self).setUp()
        self.min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        self.two_min_ago = (timezone.now() - timedelta(minutes=2)).isoformat()[:19]
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

        self.eventstore = SnubaEventStorage()

    def test_get_events(self):
        events = self.eventstore.get_events(
            filter_keys={'project_id': [self.project1.id, self.project2.id]})
        assert len(events) == 3
        # Default sort is timestamp desc, event_id desc
        assert events[0].id == "c" * 32
        assert events[1].id == "b" * 32
        assert events[2].id == "a" * 32

        # No events found
        project = self.create_project()
        events = self.eventstore.get_events(filter_keys={"project_id": [project.id]})
        assert events == []

    def test_get_event_by_id(self):
        # Get event with default columns
        event = self.eventstore.get_event_by_id(self.project1.id, 'a' * 32)

        assert event.id == 'a' * 32
        assert event.event_id == 'a' * 32
        assert event.project_id == self.project1.id
        assert len(event.snuba_data.keys()) == 4

        # Get all columns
        event = self.eventstore.get_event_by_id(
            self.project2.id, 'b' * 32, self.eventstore.full_columns)
        assert event.id == 'b' * 32
        assert event.event_id == 'b' * 32
        assert event.project_id == self.project2.id
        assert len(event.snuba_data.keys()) == 16

        # Get non existent event
        event = self.eventstore.get_event_by_id(self.project2.id, 'd' * 32)
        assert event is None

    def test_get_next_prev_event_id(self):
        event = self.eventstore.get_event_by_id(self.project2.id, 'b' * 32)

        filter_keys = {'project_id': [self.project1.id, self.project2.id]}

        prev_event = self.eventstore.get_prev_event_id(event, filter_keys=filter_keys)

        next_event = self.eventstore.get_next_event_id(event, filter_keys=filter_keys)

        assert prev_event == (six.text_type(self.project1.id), 'a' * 32)

        # Events with the same timestamp are sorted by event_id
        assert next_event == (six.text_type(self.project2.id), 'c' * 32)

        # Returns None if no event
        assert self.eventstore.get_prev_event_id(None, filter_keys=filter_keys) is None
        assert self.eventstore.get_next_event_id(None, filter_keys=filter_keys) is None
