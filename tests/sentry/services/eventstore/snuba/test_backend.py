from datetime import timedelta
from unittest import mock
from unittest.mock import MagicMock
from uuid import uuid4

from snuba_sdk import Column, Condition, Op

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.search.eap.occurrences.query_utils import (
    build_group_id_in_filter,
    build_keyset_pagination_filter,
)
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.eap.rpc_utils import and_trace_item_filters
from sentry.services.eventstore.base import Filter
from sentry.services.eventstore.models import Event
from sentry.services.eventstore.snuba.backend import SnubaEventStorage
from sentry.snuba.dataset import Dataset
from sentry.snuba.occurrences_rpc import OccurrenceCategory
from sentry.testutils.cases import (
    OccurrenceTestCase,
    PerformanceIssueTestCase,
    SnubaTestCase,
    TestCase,
)
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import snuba
from sentry.utils.samples import load_data


class SnubaEventStorageTest(TestCase, SnubaTestCase, PerformanceIssueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.two_min_ago = before_now(minutes=2)
        self.project1 = self.create_project()
        self.project2 = self.create_project()

        self.event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group1"],
                "timestamp": self.two_min_ago.isoformat(),
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
                "timestamp": self.min_ago.isoformat(),
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
                "timestamp": self.min_ago.isoformat(),
                "tags": {"foo": "1"},
            },
            project_id=self.project2.id,
        )

        event_data = load_data("transaction")
        event_data["timestamp"] = before_now(minutes=1).isoformat()
        event_data["start_timestamp"] = before_now(minutes=1, seconds=1).isoformat()
        event_data["event_id"] = "d" * 32

        self.transaction_event = self.store_event(data=event_data, project_id=self.project1.id)

        event_data_2 = load_data(
            platform="transaction-n-plus-one",
            fingerprint=[f"{PerformanceNPlusOneGroupType.type_id}-group3"],
        )
        event_data_2["timestamp"] = before_now(seconds=30).isoformat()
        event_data_2["start_timestamp"] = before_now(seconds=31).isoformat()
        event_data_2["event_id"] = "e" * 32

        self.transaction_event_2 = self.create_performance_issue(
            event_data=event_data_2, project_id=self.project2.id
        )

        event_data_3 = load_data(
            "transaction-n-plus-one", fingerprint=[f"{PerformanceNPlusOneGroupType.type_id}-group3"]
        )
        event_data_3["timestamp"] = before_now(seconds=30).isoformat()
        event_data_3["start_timestamp"] = before_now(seconds=31).isoformat()
        event_data_3["event_id"] = "f" * 32

        self.transaction_event_3 = self.create_performance_issue(
            event_data=event_data_3, project_id=self.project2.id
        )

        self.eventstore = SnubaEventStorage()

    def test_get_events(self) -> None:
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

    @mock.patch("sentry.services.nodestore.get_multi")
    def test_get_unfetched_events(self, get_multi: MagicMock) -> None:
        events = self.eventstore.get_unfetched_events(
            filter=Filter(project_ids=[self.project1.id]),
            tenant_ids={"organization_id": 123, "referrer": "r"},
        )
        assert len(events) == 1
        assert get_multi.call_count == 0

    @mock.patch("sentry.services.nodestore.get_multi")
    def test_get_unfetched_transactions(self, get_multi: MagicMock) -> None:
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

    def test_get_event_by_id(self) -> None:
        # Get valid event
        event = self.eventstore.get_event_by_id(self.project1.id, "a" * 32)

        assert event is not None
        assert event.group is not None
        assert event.event_id == "a" * 32
        assert event.project_id == self.project1.id
        assert event.group_id == event.group.id

        # Get non existent event
        event = self.eventstore.get_event_by_id(self.project2.id, "z" * 32)
        assert event is None

        # Get transaction
        event = self.eventstore.get_event_by_id(self.project2.id, self.transaction_event_2.event_id)

        assert event is not None
        assert event.event_id == "e" * 32
        assert event.get_event_type() == "transaction"
        assert event.project_id == self.project2.id

    def test_get_event_by_id_cached(self) -> None:
        # Simulate getting an event that exists in eventstore but has not yet been written to snuba.
        with mock.patch("sentry.services.eventstore.snuba.backend.Event") as mock_event:
            dummy_event = Event(
                project_id=self.project2.id,
                event_id="1" * 32,
                data={"something": "hi", "timestamp": self.min_ago.isoformat(), "type": "error"},
            )
            mock_event.return_value = dummy_event
            event = self.eventstore.get_event_by_id(self.project2.id, "1" * 32)
            # Result of query should be None
            assert event is None

        # Now we store the event properly, so it will exist in Snuba.
        self.store_event(
            data={"event_id": "1" * 32, "timestamp": self.min_ago.isoformat(), "type": "error"},
            project_id=self.project2.id,
        )

        # Make sure that the negative cache isn't causing the event to not show up
        event = self.eventstore.get_event_by_id(self.project2.id, "1" * 32)
        assert event is not None
        assert event.group is not None
        assert event.event_id == "1" * 32
        assert event.project_id == self.project2.id
        assert event.group_id == event.group.id

    def test_get_events_snql_with_inner_limit(self) -> None:
        project = self.create_project()
        ts_old = before_now(minutes=6).isoformat()
        ts_mid = before_now(minutes=5).isoformat()
        ts_new = before_now(minutes=4).isoformat()

        event_oldest = self.store_event(
            data={
                "event_id": "1" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["inner-limit-group"],
                "timestamp": ts_old,
            },
            project_id=project.id,
        )
        event_middle = self.store_event(
            data={
                "event_id": "2" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["inner-limit-group"],
                "timestamp": ts_mid,
            },
            project_id=project.id,
        )
        event_newest = self.store_event(
            data={
                "event_id": "3" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["inner-limit-group"],
                "timestamp": ts_new,
            },
            project_id=project.id,
        )

        group_id = event_oldest.group_id
        assert group_id is not None
        eventstore = SnubaEventStorage()

        # Ascending order should return oldest first when no inner limit is used
        no_inner = eventstore.get_events_snql(
            organization_id=project.organization.id,
            group_id=group_id,
            start=before_now(minutes=10),
            end=before_now(minutes=0),
            conditions=[
                Condition(Column("project_id"), Op.IN, [project.id]),
                Condition(Column("group_id"), Op.IN, [group_id]),
            ],
            orderby=["timestamp", "event_id"],
            dataset=Dataset.Events,
            tenant_ids={"organization_id": project.organization.id},
            limit=2,
        )
        assert [e.event_id for e in no_inner] == [event_oldest.event_id, event_middle.event_id]

        # With inner_limit=2 we first query for the two most recent events, THEN apply sorting
        # The result of which should be [event_middle, event_newest]
        with_inner = eventstore.get_events_snql(
            organization_id=project.organization.id,
            group_id=group_id,
            start=before_now(minutes=10),
            end=before_now(minutes=0),
            conditions=[
                Condition(Column("project_id"), Op.IN, [project.id]),
                Condition(Column("group_id"), Op.IN, [group_id]),
            ],
            orderby=["timestamp", "event_id"],
            dataset=Dataset.Events,
            tenant_ids={"organization_id": project.organization.id},
            limit=2,
            inner_limit=2,
        )
        assert [e.event_id for e in with_inner] == [event_middle.event_id, event_newest.event_id]

    def test_get_event_beyond_retention(self) -> None:
        event = self.store_event(
            data={
                "event_id": "d" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group2"],
                "timestamp": before_now(days=14).isoformat(),
                "tags": {"foo": "1"},
            },
            project_id=self.project2.id,
        )

        with mock.patch("sentry.quotas.backend.get_event_retention", return_value=7):
            event = self.eventstore.get_event_by_id(self.project2.id, "d" * 32)
            assert event is None

    def test_get_adjacent_event_ids(self) -> None:
        event = self.eventstore.get_event_by_id(self.project2.id, "b" * 32)
        assert event is not None

        filter = Filter(project_ids=[self.project1.id, self.project2.id])

        prev_event, next_event = self.eventstore.get_adjacent_event_ids(event, filter=filter)

        assert prev_event == (str(self.project1.id), "a" * 32)

        # Events with the same timestamp are sorted by event_id
        assert next_event == (str(self.project2.id), "c" * 32)

        # Returns None if the prev event is outside the start window
        period_filter = Filter(
            project_ids=[self.project1.id, self.project2.id],
            start=self.min_ago,
        )
        prev_event, next_event = self.eventstore.get_adjacent_event_ids(event, filter=period_filter)
        assert prev_event is None
        assert next_event == (str(self.project2.id), "c" * 32)

        # Returns None if the next event is outside the end window
        period_filter = Filter(
            project_ids=[self.project1.id, self.project2.id],
            end=self.min_ago,
        )
        prev_event, next_event = self.eventstore.get_adjacent_event_ids(event, filter=period_filter)
        assert prev_event == (str(self.project1.id), "a" * 32)
        assert next_event is None

        # Returns None if no event
        prev_event, next_event = self.eventstore.get_adjacent_event_ids(None, filter=filter)

        assert prev_event is None
        assert next_event is None

        # Returns None if the query fails for a known reason
        with mock.patch(
            "sentry.utils.snuba.bulk_raw_query", side_effect=snuba.QueryOutsideRetentionError()
        ):
            prev_event, next_event = self.eventstore.get_adjacent_event_ids(event, filter=filter)

        assert prev_event is None
        assert next_event is None

    def test_adjacent_event_ids_same_timestamp(self) -> None:
        project = self.create_project()

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": self.min_ago.isoformat(),
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

    def test_transaction_get_next_prev_event_id(self) -> None:
        group = self.transaction_event_2.group
        assert group is not None
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

    def test_get_adjacent_event_ids_snql(self) -> None:
        project = self.create_project()
        data = {
            "type": "default",
            "platform": "python",
            "fingerprint": ["group"],
        }
        self.store_event(
            data={**data, "event_id": "a" * 32, "timestamp": before_now(minutes=10).isoformat()},
            project_id=project.id,
        )
        event1 = self.store_event(
            data={**data, "event_id": "b" * 32, "timestamp": before_now(minutes=4).isoformat()},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={**data, "event_id": "c" * 32, "timestamp": before_now(minutes=3).isoformat()},
            project_id=project.id,
        )
        event3 = self.store_event(
            data={**data, "event_id": "d" * 32, "timestamp": before_now(minutes=2).isoformat()},
            project_id=project.id,
        )
        self.store_event(
            data={**data, "event_id": "e" * 32, "timestamp": before_now(minutes=0).isoformat()},
            project_id=project.id,
        )

        # Finds next and previous IDs
        prev_ids, next_ids = self.eventstore.get_adjacent_event_ids_snql(
            organization_id=event2.organization.id,
            project_id=event2.project_id,
            group_id=event2.group_id,
            environments=[],
            event=event2,
        )

        assert prev_ids == (str(event1.project_id), event1.event_id)
        assert next_ids == (str(event3.project_id), event3.event_id)

        # Filter previous events that are outside of the start window
        prev_ids, _ = self.eventstore.get_adjacent_event_ids_snql(
            organization_id=event1.organization.id,
            project_id=event1.project_id,
            group_id=event1.group_id,
            environments=[],
            event=event1,
            start=before_now(minutes=5),
        )
        assert prev_ids is None

        # Filter next events that are outside of the end window
        _, next_ids = self.eventstore.get_adjacent_event_ids_snql(
            organization_id=event3.organization.id,
            project_id=event3.project_id,
            group_id=event3.group_id,
            environments=[],
            event=event3,
            end=before_now(minutes=1),
        )
        assert next_ids is None

    def test_get_adjacent_event_ids_snql_order_of_event_ids(self) -> None:
        project = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "c" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": self.two_min_ago.isoformat(),
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=project.id,
        )
        event3 = self.store_event(
            data={
                "event_id": "a" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": before_now(minutes=0).isoformat(),
            },
            project_id=project.id,
        )
        prev_ids, next_ids = self.eventstore.get_adjacent_event_ids_snql(
            organization_id=event2.organization.id,
            project_id=event2.project_id,
            group_id=event2.group_id,
            environments=[],
            event=event2,
        )

        assert prev_ids == (str(event1.project_id), event1.event_id)
        assert next_ids == (str(event3.project_id), event3.event_id)

    def test_adjacent_event_ids_same_timestamp_snql(self) -> None:
        project = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=project.id,
        )

        # the 2 events should be in the same group
        assert event1.group_id == event2.group_id
        # the 2 events should have the same timestamp
        assert event1.datetime == event2.datetime

        prev_ids, next_ids = self.eventstore.get_adjacent_event_ids_snql(
            organization_id=event1.organization.id,
            project_id=event1.project_id,
            group_id=event1.group_id,
            environments=[],
            event=event1,
        )

        assert prev_ids is None
        assert next_ids == (str(project.id), event2.event_id)

        prev_ids, next_ids = self.eventstore.get_adjacent_event_ids_snql(
            organization_id=event2.organization.id,
            project_id=event2.project_id,
            group_id=event2.group_id,
            environments=[],
            event=event2,
        )

        assert prev_ids == (str(project.id), event1.event_id)
        assert next_ids is None

    def test_adjacent_event_ids_with_query_conditions(self) -> None:
        project = self.create_project()
        event_a = self.store_event(
            data={
                "event_id": "a" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": self.min_ago.isoformat(),
                "tags": {"organization.slug": "sentry"},
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=project.id,
        )
        event_c = self.store_event(
            data={
                "event_id": "c" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": self.min_ago.isoformat(),
                "tags": {"organization.slug": "sentry"},
            },
            project_id=project.id,
        )

        query_conditions = [Condition(Column("tags[organization.slug]"), Op.EQ, "sentry")]

        prev_ids, next_ids = self.eventstore.get_adjacent_event_ids_snql(
            organization_id=event_a.organization.id,
            project_id=event_a.project_id,
            group_id=event_a.group_id,
            environments=[],
            event=event_a,
            conditions=query_conditions,
        )

        assert prev_ids is None
        assert next_ids == (str(event_c.project_id), event_c.event_id)

        prev_ids, next_ids = self.eventstore.get_adjacent_event_ids_snql(
            organization_id=event_c.organization.id,
            project_id=event_c.project_id,
            group_id=event_c.group_id,
            environments=[],
            event=event_c,
            conditions=query_conditions,
        )

        assert prev_ids == (str(event_a.project_id), event_a.event_id)
        assert next_ids is None

    def test_adjacent_event_ids_with_date_range_conditions(self) -> None:
        project = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": before_now(hours=1).isoformat(),
            },
            project_id=project.id,
        )
        event_b = self.store_event(
            data={
                "event_id": "b" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": before_now(hours=2).isoformat(),
            },
            project_id=project.id,
        )
        event_c = self.store_event(
            data={
                "event_id": "c" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": before_now(hours=3).isoformat(),
            },
            project_id=project.id,
        )
        event_d = self.store_event(
            data={
                "event_id": "d" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": before_now(hours=4).isoformat(),
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "e" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group"],
                "timestamp": before_now(hours=5).isoformat(),
            },
            project_id=project.id,
        )

        # -> E (5h ago), D (4h ago), C (3h ago), B (2h ago), A (1h ago), now
        date_range_conditions = [
            Condition(Column("timestamp"), Op.LT, before_now(hours=1.5)),
            Condition(Column("timestamp"), Op.GT, before_now(hours=4.5)),
        ]

        prev_ids, next_ids = self.eventstore.get_adjacent_event_ids_snql(
            organization_id=event_b.organization.id,
            project_id=event_b.project_id,
            group_id=event_b.group_id,
            environments=[],
            event=event_b,
            conditions=date_range_conditions,
        )

        assert prev_ids == (str(event_c.project_id), event_c.event_id)
        assert next_ids is None

        prev_ids, next_ids = self.eventstore.get_adjacent_event_ids_snql(
            organization_id=event_d.organization.id,
            project_id=event_d.project_id,
            group_id=event_d.group_id,
            environments=[],
            event=event_d,
            conditions=date_range_conditions,
        )

        assert prev_ids is None
        assert next_ids == (str(event_c.project_id), event_c.event_id)


class EAPEventStorageTest(TestCase, SnubaTestCase, OccurrenceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.eventstore = SnubaEventStorage()
        self.now = before_now(minutes=1)

    def test_get_event_by_id_eap_returns_correct_group_id(self) -> None:
        group = self.create_group(project=self.project)
        event_id = uuid4().hex

        trace_item = self.create_eap_occurrence(
            group_id=group.id,
            event_id=event_id,
            timestamp=self.now,
        )
        self.store_eap_items([trace_item])

        result = self.eventstore._get_event_by_id_eap(
            project_id=self.project.id,
            event_id=event_id,
            event_datetime=self.now,
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ERROR,
        )

        assert result is not None
        assert result["group_id"] == group.id
        assert result["project_id"] == self.project.id
        assert result["id"] == event_id

    def test_get_event_by_id_eap_returns_none_for_nonexistent_event(self) -> None:
        result = self.eventstore._get_event_by_id_eap(
            project_id=self.project.id,
            event_id=uuid4().hex,
            event_datetime=self.now,
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ERROR,
        )
        assert result is None

    def test_get_event_by_id_eap_filters_by_group_id(self) -> None:
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        event_id = uuid4().hex

        trace_item = self.create_eap_occurrence(
            group_id=group1.id,
            event_id=event_id,
            timestamp=self.now,
        )
        self.store_eap_items([trace_item])

        # Querying with the correct group_id returns the event
        result = self.eventstore._get_event_by_id_eap(
            project_id=self.project.id,
            event_id=event_id,
            event_datetime=self.now,
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ERROR,
            group_id=group1.id,
        )
        assert result is not None
        assert result["group_id"] == group1.id

        # Querying with the wrong group_id returns nothing
        result = self.eventstore._get_event_by_id_eap(
            project_id=self.project.id,
            event_id=event_id,
            event_datetime=self.now,
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ERROR,
            group_id=group2.id,
        )
        assert result is None

    def test_get_event_by_id_eap_occurrence_category_filtering(self) -> None:
        group = self.create_group(project=self.project)
        error_event_id = uuid4().hex
        ip_event_id = uuid4().hex
        occurrence_id = uuid4().hex

        error_item = self.create_eap_occurrence(
            group_id=group.id,
            event_id=error_event_id,
            timestamp=self.now,
        )
        ip_item = self.create_eap_occurrence(
            group_id=group.id,
            event_id=ip_event_id,
            timestamp=self.now,
            issue_occurrence_id=occurrence_id,
        )
        self.store_eap_items([error_item, ip_item])

        # ERROR category returns only the error item
        result = self.eventstore._get_event_by_id_eap(
            project_id=self.project.id,
            event_id=error_event_id,
            event_datetime=self.now,
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ERROR,
        )
        assert result is not None
        assert result["id"] == error_event_id
        assert result["group_id"] == group.id
        assert result["project_id"] == self.project.id
        assert result["timestamp"] is not None

        # ERROR category does not return the issue platform item
        result = self.eventstore._get_event_by_id_eap(
            project_id=self.project.id,
            event_id=ip_event_id,
            event_datetime=self.now,
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ERROR,
        )
        assert result is None

        # ISSUE_PLATFORM category returns only the issue platform item
        result = self.eventstore._get_event_by_id_eap(
            project_id=self.project.id,
            event_id=ip_event_id,
            event_datetime=self.now,
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ISSUE_PLATFORM,
        )
        assert result is not None
        assert result["id"] == ip_event_id
        assert result["group_id"] == group.id
        assert result["project_id"] == self.project.id
        assert result["timestamp"] is not None
        assert result["issue_occurrence_id"] == occurrence_id

        # ISSUE_PLATFORM category does not return the error item
        result = self.eventstore._get_event_by_id_eap(
            project_id=self.project.id,
            event_id=error_event_id,
            event_datetime=self.now,
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ISSUE_PLATFORM,
        )
        assert result is None

    def test_get_event_by_id_eap_respects_time_window(self) -> None:
        group = self.create_group(project=self.project)
        event_id = uuid4().hex

        trace_item = self.create_eap_occurrence(
            group_id=group.id,
            event_id=event_id,
            timestamp=self.now,
        )
        self.store_eap_items([trace_item])

        # Querying with a time window that includes the event returns it
        result = self.eventstore._get_event_by_id_eap(
            project_id=self.project.id,
            event_id=event_id,
            event_datetime=self.now,
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ERROR,
        )
        assert result is not None

        # Querying with a time window that excludes the event returns None
        wrong_time = self.now - timedelta(hours=2)
        result = self.eventstore._get_event_by_id_eap(
            project_id=self.project.id,
            event_id=event_id,
            event_datetime=wrong_time,
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ERROR,
        )
        assert result is None

    def test_get_events_eap_basic(self) -> None:
        group = self.create_group(project=self.project)
        event_ids = [uuid4().hex for _ in range(3)]
        timestamps = [
            before_now(minutes=3),
            before_now(minutes=2),
            before_now(minutes=1),
        ]

        items = [
            self.create_eap_occurrence(
                group_id=group.id,
                event_id=eid,
                timestamp=ts,
            )
            for eid, ts in zip(event_ids, timestamps)
        ]
        self.store_eap_items(items)

        result = self.eventstore._get_events_eap(
            eap_conditions=build_group_id_in_filter([group.id]),
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ERROR,
            orderby=["-timestamp", "-event_id"],
            limit=10,
            offset=0,
            referrer="test.get_events_eap_basic",
        )

        assert result is not None
        assert len(result) == 3
        for row in result:
            assert row["id"] in event_ids
            assert row["group_id"] == group.id
            assert row["project_id"] == self.project.id
            assert "timestamp" in row

        # Verify descending timestamp order
        result_timestamps = [row["timestamp"] for row in result]
        assert result_timestamps == sorted(result_timestamps, reverse=True)

    def test_get_events_eap_with_pagination(self) -> None:
        group = self.create_group(project=self.project)
        timestamps = [before_now(minutes=i) for i in range(5, 0, -1)]
        event_ids = [uuid4().hex for _ in range(5)]

        items = [
            self.create_eap_occurrence(
                group_id=group.id,
                event_id=eid,
                timestamp=ts,
            )
            for eid, ts in zip(event_ids, timestamps)
        ]
        self.store_eap_items(items)

        # Use the middle event as a pagination cursor
        middle_ts = timestamps[2].isoformat()
        middle_eid = event_ids[2]

        eap_conditions = and_trace_item_filters(
            build_group_id_in_filter([group.id]),
            build_keyset_pagination_filter(
                timestamp_value=middle_ts,
                event_id=middle_eid,
            ),
        )
        assert eap_conditions is not None

        result = self.eventstore._get_events_eap(
            eap_conditions=eap_conditions,
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ERROR,
            orderby=["-timestamp", "-event_id"],
            limit=10,
            offset=0,
            referrer="test.get_events_eap_pagination",
        )

        assert result is not None
        # Should only include events at or before the middle timestamp
        assert len(result) <= 3

    def test_get_events_eap_occurrence_category_filtering(self) -> None:
        group = self.create_group(project=self.project)
        error_event_id = uuid4().hex
        ip_event_id = uuid4().hex
        occurrence_id = uuid4().hex

        error_item = self.create_eap_occurrence(
            group_id=group.id,
            event_id=error_event_id,
            timestamp=self.now,
        )
        ip_item = self.create_eap_occurrence(
            group_id=group.id,
            event_id=ip_event_id,
            timestamp=self.now,
            issue_occurrence_id=occurrence_id,
        )
        self.store_eap_items([error_item, ip_item])

        eap_conditions = build_group_id_in_filter([group.id])

        error_result = self.eventstore._get_events_eap(
            eap_conditions=eap_conditions,
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ERROR,
        )
        assert error_result is not None
        error_ids = {row["id"] for row in error_result}
        assert error_event_id in error_ids
        assert ip_event_id not in error_ids

        ip_result = self.eventstore._get_events_eap(
            eap_conditions=eap_conditions,
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            occurrence_category=OccurrenceCategory.ISSUE_PLATFORM,
        )
        assert ip_result is not None
        ip_ids = {row["id"] for row in ip_result}
        assert ip_event_id in ip_ids
        assert error_event_id not in ip_ids

    def test_get_events_double_read_end_to_end(self) -> None:
        event = self.store_event(
            data={
                "event_id": uuid4().hex,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group1"],
                "timestamp": self.now.isoformat(),
            },
            project_id=self.project.id,
        )

        trace_item = self.create_eap_occurrence(
            group_id=event.group_id,
            event_id=event.event_id,
            timestamp=self.now,
        )
        self.store_eap_items([trace_item])

        eap_conditions = build_group_id_in_filter([event.group_id])
        callsite = "eventstore.backend.get_events"

        with self.options(
            {
                EAPOccurrencesComparator._should_eval_option_name(): True,
                EAPOccurrencesComparator._callsite_allowlist_option_name(): [callsite],
            }
        ):
            events = self.eventstore.get_events(
                filter=Filter(
                    project_ids=[self.project.id],
                    group_ids=[event.group_id],
                ),
                eap_conditions=eap_conditions,
                tenant_ids={
                    "organization_id": self.organization.id,
                    "referrer": "test.double_read",
                },
            )

        assert len(events) == 1
        assert events[0].event_id == event.event_id
        assert events[0].group_id == event.group_id
