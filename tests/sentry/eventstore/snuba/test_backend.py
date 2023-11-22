from unittest import mock

from sentry.eventstore.base import Filter
from sentry.eventstore.models import Event
from sentry.eventstore.snuba.backend import SnubaEventStorage
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.testutils.cases import PerformanceIssueTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils import snuba
from sentry.utils.samples import load_data


@region_silo_test
class SnubaEventStorageTest(TestCase, SnubaTestCase, PerformanceIssueTestCase):
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

        self.transaction_event = self.store_event(data=event_data, project_id=self.project1.id)

        event_data_2 = load_data(
            platform="transaction-n-plus-one",
            fingerprint=[f"{PerformanceNPlusOneGroupType.type_id}-group3"],
        )
        event_data_2["timestamp"] = iso_format(before_now(seconds=30))
        event_data_2["start_timestamp"] = iso_format(before_now(seconds=31))
        event_data_2["event_id"] = "e" * 32

        self.transaction_event_2 = self.create_performance_issue(
            event_data=event_data_2, project_id=self.project2.id
        )

        event_data_3 = load_data(
            "transaction-n-plus-one", fingerprint=[f"{PerformanceNPlusOneGroupType.type_id}-group3"]
        )
        event_data_3["timestamp"] = iso_format(before_now(seconds=30))
        event_data_3["start_timestamp"] = iso_format(before_now(seconds=31))
        event_data_3["event_id"] = "f" * 32

        self.transaction_event_3 = self.create_performance_issue(
            event_data=event_data_3, project_id=self.project2.id
        )

        """
        event_data_4 = load_data("transaction")
        event_data_4["timestamp"] = iso_format(before_now(seconds=30))
        event_data_4["start_timestamp"] = iso_format(before_now(seconds=31))

        event_data_4["event_id"] = "g" * 32

        self.transaction_event_4 = self.store_event(data=event_data_4, project_id=self.project2.id)
        """

        self.eventstore = SnubaEventStorage()

    def test_get_events(self):
        events = self.eventstore.get_events(
            filter=Filter(
                project_ids=[self.project1.id, self.project2.id],
                conditions=[
                    ["type", "!=", "transaction"]
                ],  # TODO: Remove once errors storage rolled out
            ),
            tenant_ids={"organization_id": 123, "referrer": "r"},
        )
        assert len(events) == 3
        # Default sort is timestamp desc, event_id desc
        assert events[0].event_id == "c" * 32
        assert events[1].event_id == "b" * 32
        assert events[2].event_id == "a" * 32

        # No events found
        project = self.create_project()
        events = self.eventstore.get_events(
            filter=Filter(project_ids=[project.id]),
            tenant_ids={"organization_id": 123, "referrer": "r"},
        )
        assert events == []

        # Test with a list of event IDs and project ID filters
        events = self.eventstore.get_events(
            filter=Filter(
                project_ids=[self.project1.id, self.project2.id],
                event_ids=["a" * 32, "b" * 32, "c" * 32, "x" * 32, "y" * 32, "z" * 32],
            ),
            tenant_ids={"organization_id": 123, "referrer": "r"},
        )
        assert len(events) == 3
        assert events[0].event_id == "c" * 32
        assert events[1].event_id == "b" * 32
        assert events[2].event_id == "a" * 32

    @mock.patch("sentry.nodestore.get_multi")
    def test_get_unfetched_events(self, get_multi):
        events = self.eventstore.get_unfetched_events(
            filter=Filter(project_ids=[self.project1.id]),
            tenant_ids={"organization_id": 123, "referrer": "r"},
        )
        assert len(events) == 1
        assert get_multi.call_count == 0

    @mock.patch("sentry.nodestore.get_multi")
    def test_get_unfetched_transactions(self, get_multi):
        transactions_proj1 = self.eventstore.get_unfetched_transactions(
            filter=Filter(project_ids=[self.project1.id]),
            tenant_ids={"organization_id": self.project1.organization_id},
        )
        assert len(transactions_proj1) == 1
        assert get_multi.call_count == 0

        transactions_proj2 = self.eventstore.get_unfetched_transactions(
            filter=Filter(project_ids=[self.project2.id]),
            tenant_ids={"organization_id": self.project1.organization_id},
        )
        assert len(transactions_proj2) == 2
        assert get_multi.call_count == 0

    def test_get_event_by_id(self):
        # Get valid event
        event = self.eventstore.get_event_by_id(self.project1.id, "a" * 32)

        assert event.event_id == "a" * 32
        assert event.project_id == self.project1.id
        assert event.group_id == event.group.id

        # Get non existent event
        event = self.eventstore.get_event_by_id(self.project2.id, "z" * 32)
        assert event is None

        # Get transaction
        event = self.eventstore.get_event_by_id(self.project2.id, self.transaction_event_2.event_id)

        assert event.event_id == "e" * 32
        assert event.get_event_type() == "transaction"
        assert event.project_id == self.project2.id

    def test_get_event_by_id_cached(self):
        # Simulate getting an event that exists in eventstore but has not yet been written to snuba.
        with mock.patch("sentry.eventstore.snuba.backend.Event") as mock_event:
            dummy_event = Event(
                project_id=self.project2.id,
                event_id="1" * 32,
                data={"something": "hi", "timestamp": self.min_ago, "type": "error"},
            )
            mock_event.return_value = dummy_event
            event = self.eventstore.get_event_by_id(self.project2.id, "1" * 32)
            # Result of query should be None
            assert event is None

        # Now we store the event properly, so it will exist in Snuba.
        self.store_event(
            data={"event_id": "1" * 32, "timestamp": self.min_ago, "type": "error"},
            project_id=self.project2.id,
        )

        # Make sure that the negative cache isn't causing the event to not show up
        event = self.eventstore.get_event_by_id(self.project2.id, "1" * 32)
        assert event.event_id == "1" * 32
        assert event.project_id == self.project2.id
        assert event.group_id == event.group.id

    def test_get_event_beyond_retention(self):
        event = self.store_event(
            data={
                "event_id": "d" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group2"],
                "timestamp": iso_format(before_now(days=14)),
                "tags": {"foo": "1"},
            },
            project_id=self.project2.id,
        )

        with mock.patch("sentry.quotas.backend.get_event_retention", return_value=7):
            event = self.eventstore.get_event_by_id(self.project2.id, "d" * 32)
            assert event is None

    def test_get_adjacent_event_ids(self):
        event = self.eventstore.get_event_by_id(self.project2.id, "b" * 32)

        _filter = Filter(project_ids=[self.project1.id, self.project2.id])

        prev_event, next_event = self.eventstore.get_adjacent_event_ids(event, filter=_filter)

        assert prev_event == (str(self.project1.id), "a" * 32)

        # Events with the same timestamp are sorted by event_id
        assert next_event == (str(self.project2.id), "c" * 32)

        # Returns None if no event
        prev_event_none, next_event_none = self.eventstore.get_adjacent_event_ids(
            None, filter=_filter
        )

        assert prev_event_none is None
        assert next_event_none is None

        # Returns None if the query fails for a known reason
        with mock.patch(
            "sentry.utils.snuba.bulk_raw_query", side_effect=snuba.QueryOutsideRetentionError()
        ):
            prev_event_none, next_event_none = self.eventstore.get_adjacent_event_ids(
                event, filter=_filter
            )

        assert prev_event_none is None
        assert next_event_none is None

    def test_adjacent_event_ids_same_timestamp(self):
        project = self.create_project()

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": self.min_ago,
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": self.min_ago,
            },
            project_id=project.id,
        )

        # the 2 events should be in the same group
        assert event1.group_id == event2.group_id
        # the 2 events should have the same timestamp
        assert event1.datetime == event2.datetime

        _filter = Filter(
            project_ids=[project.id],
            conditions=[["event.type", "!=", "transaction"]],
            group_ids=[event1.group_id],
        )

        event = self.eventstore.get_event_by_id(project.id, "a" * 32)

        prev_event, next_event = self.eventstore.get_adjacent_event_ids(event, filter=_filter)
        assert prev_event is None
        assert next_event == (str(project.id), "b" * 32)

        event = self.eventstore.get_event_by_id(project.id, "b" * 32)

        prev_event, next_event = self.eventstore.get_adjacent_event_ids(event, filter=_filter)
        assert prev_event == (str(project.id), "a" * 32)
        assert next_event is None

    def test_transaction_get_next_prev_event_id(self):
        group = self.transaction_event_2.group
        _filter = Filter(
            project_ids=[self.project2.id],
            group_ids=[group.id],
        )
        event = self.eventstore.get_event_by_id(
            self.project2.id, self.transaction_event_3.event_id, group_id=group.id
        )
        prev_event, next_event = self.eventstore.get_adjacent_event_ids(event, filter=_filter)

        assert prev_event == (str(self.project2.id), self.transaction_event_2.event_id)
        assert next_event is None

        event = self.eventstore.get_event_by_id(
            self.project2.id, self.transaction_event_2.event_id, group_id=group.id
        )
        prev_event, next_event = self.eventstore.get_adjacent_event_ids(event, filter=_filter)

        assert prev_event is None
        assert next_event == (str(self.project2.id), self.transaction_event_3.event_id)
