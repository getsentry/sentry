from sentry.eventstore.base import EventStorage
from sentry.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


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
        min_ago = before_now(minutes=1).isoformat()
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
        before = event.data._node_data
        self.eventstorage.bind_nodes([event, event2])
        after = event.data._node_data
        assert before is None
        assert after is not None
        assert event.data["user"]["id"] == "user1"
