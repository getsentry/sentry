from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import SnubaEvent
from sentry.testutils import TestCase
from sentry.eventstore.base import EventStorage


class EventStorageTest(TestCase):
    def setUp(self):
        self.eventstorage = EventStorage()

    def test_minimal_columns(self):
        assert len(self.eventstorage.minimal_columns) == 4

    def test_full_columns(self):
        assert len(self.eventstorage.full_columns) == 16

    def test_bind_nodes(self):
        """
        Test that bind_nodes populates _node_data
        """
        min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": min_ago, "user": {"id": u"user1"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "timestamp": min_ago, "user": {"id": u"user2"}},
            project_id=self.project.id,
        )

        event = SnubaEvent.objects.from_event_id("a" * 32, self.project.id)
        event2 = SnubaEvent.objects.from_event_id("b" * 32, self.project.id)
        assert event.data._node_data is None
        self.eventstorage.bind_nodes([event, event2], "data")
        assert event.data._node_data is not None
        assert event.data["user"]["id"] == u"user1"
