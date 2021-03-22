from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.eventstore.snuba.backend import SnubaEventStorage
from sentry.eventstore.base import Filter
from sentry.utils.compat import mock
from sentry.utils.samples import load_data


class SnubaEventStorageTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
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
        event_data["timestamp"] = iso_format(before_now(minutes=1))
        event_data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=1))
        event_data["event_id"] = "d" * 32

        self.transaction_event = self.store_event(data=event_data, project_id=self.project2.id)

        event_data_2 = load_data("transaction")
        event_data_2["timestamp"] = iso_format(before_now(seconds=30))
        event_data_2["start_timestamp"] = iso_format(before_now(seconds=31))

        event_data_2["event_id"] = "e" * 32

        self.transaction_event_2 = self.store_event(data=event_data_2, project_id=self.project2.id)

        self.eventstore = SnubaEventStorage()

    def test_get_events(self):
        events = self.eventstore.get_events(
            filter=Filter(
                project_ids=[self.project1.id, self.project2.id],
                conditions=[
                    ["type", "!=", "transaction"]
                ],  # TODO: Remove once errors storage rolled out
            )
        )
        assert len(events) == 3
        # Default sort is timestamp desc, event_id desc
        assert events[0].event_id == "c" * 32
        assert events[1].event_id == "b" * 32
        assert events[2].event_id == "a" * 32

        # No events found
        project = self.create_project()
        events = self.eventstore.get_events(filter=Filter(project_ids=[project.id]))
        assert events == []

        # Test with a list of event IDs and project ID filters
        events = self.eventstore.get_events(
            filter=Filter(
                project_ids=[self.project1.id, self.project2.id],
                event_ids=["a" * 32, "b" * 32, "c" * 32, "x" * 32, "y" * 32, "z" * 32],
            )
        )
        assert len(events) == 3
        assert events[0].event_id == "c" * 32
        assert events[1].event_id == "b" * 32
        assert events[2].event_id == "a" * 32

    @mock.patch("sentry.nodestore.get_multi")
    def test_get_unfetched_events(self, get_multi):
        events = self.eventstore.get_unfetched_events(filter=Filter(project_ids=[self.project1.id]))
        assert len(events) == 1
        assert get_multi.call_count == 0

    def test_get_event_by_id(self):
        # Get valid event
        event = self.eventstore.get_event_by_id(self.project1.id, "a" * 32)

        assert event.event_id == "a" * 32
        assert event.project_id == self.project1.id
        assert event.group_id == event.group.id

        # Get non existent event
        event = self.eventstore.get_event_by_id(self.project2.id, "f" * 32)
        assert event is None

        # Get transaction
        event = self.eventstore.get_event_by_id(self.project2.id, self.transaction_event.event_id)

        assert event.event_id == "d" * 32
        assert event.get_event_type() == "transaction"
        assert event.project_id == self.project2.id

    def test_get_next_prev_event_id(self):
        event = self.eventstore.get_event_by_id(self.project2.id, "b" * 32)

        _filter = Filter(project_ids=[self.project1.id, self.project2.id])

        prev_event = self.eventstore.get_prev_event_id(event, filter=_filter)

        next_event = self.eventstore.get_next_event_id(event, filter=_filter)

        assert prev_event == (str(self.project1.id), "a" * 32)

        # Events with the same timestamp are sorted by event_id
        assert next_event == (str(self.project2.id), "c" * 32)

        # Returns None if no event
        assert self.eventstore.get_prev_event_id(None, filter=_filter) is None
        assert self.eventstore.get_next_event_id(None, filter=_filter) is None

    def test_get_latest_or_oldest_event_id(self):
        # Returns a latest/oldest event
        event = self.eventstore.get_event_by_id(self.project2.id, "b" * 32)
        _filter = Filter(project_ids=[self.project1.id, self.project2.id])
        oldest_event = self.eventstore.get_earliest_event_id(event, filter=_filter)
        latest_event = self.eventstore.get_latest_event_id(event, filter=_filter)
        assert oldest_event == (str(self.project1.id), "a" * 32)
        assert latest_event == (str(self.project2.id), "e" * 32)

        # Returns none when no latest/oldest event that meets conditions
        event = self.eventstore.get_event_by_id(self.project2.id, "b" * 32)
        _filter = Filter(project_ids=[self.project1.id], group_ids=[self.event2.group_id])
        oldest_event = self.eventstore.get_earliest_event_id(event, filter=_filter)
        latest_event = self.eventstore.get_latest_event_id(event, filter=_filter)
        assert oldest_event is None
        assert latest_event is None

    def test_transaction_get_next_prev_event_id(self):
        _filter = Filter(
            project_ids=[self.project1.id, self.project2.id],
            conditions=[["event.type", "=", "transaction"]],
        )

        event = self.eventstore.get_event_by_id(self.project2.id, "e" * 32)
        prev_event = self.eventstore.get_prev_event_id(event, filter=_filter)
        next_event = self.eventstore.get_next_event_id(event, filter=_filter)
        assert prev_event == (str(self.project2.id), "d" * 32)
        assert next_event is None

        event = self.eventstore.get_event_by_id(self.project2.id, "d" * 32)
        prev_event = self.eventstore.get_prev_event_id(event, filter=_filter)
        next_event = self.eventstore.get_next_event_id(event, filter=_filter)
        assert prev_event is None
        assert next_event == (str(self.project2.id), "e" * 32)
