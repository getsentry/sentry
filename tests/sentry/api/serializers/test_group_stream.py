from unittest import mock

from sentry import tsdb
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import (
    StreamGroupSerializer,
    StreamGroupSerializerSnuba,
)
from sentry.issues.grouptype import GroupCategory, ProfileFileIOGroupType
from sentry.models.environment import Environment
from sentry.testutils.cases import BaseMetricsTestCase, PerformanceIssueTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from tests.sentry.issues.test_utils import SearchIssueTestMixin


class StreamGroupSerializerTestCase(
    TestCase, BaseMetricsTestCase, SearchIssueTestMixin, PerformanceIssueTestCase
):
    def test_environment(self) -> None:
        group = self.group

        environment = Environment.get_or_create(group.project, "production")

        with mock.patch(
            "sentry.tsdb.backend.get_range", side_effect=tsdb.backend.get_range
        ) as get_range:
            serialize(
                [group],
                serializer=StreamGroupSerializer(
                    environment_func=lambda: environment, stats_period="14d"
                ),
            )
            assert get_range.call_count == 1
            for args, kwargs in get_range.call_args_list:
                assert kwargs["environment_ids"] == [environment.id]

        def get_invalid_environment() -> None:
            raise Environment.DoesNotExist()

        with mock.patch(
            "sentry.tsdb.backend.make_series",
            side_effect=tsdb.backend.make_series,
        ) as make_series:
            serialize(
                [group],
                serializer=StreamGroupSerializer(
                    environment_func=get_invalid_environment, stats_period="14d"
                ),
            )
            assert make_series.call_count == 1

    @freeze_time(before_now(days=1).replace(hour=13, minute=30, second=0, microsecond=0))
    def test_perf_issue(self) -> None:
        event = self.create_performance_issue()
        group = event.group
        serialized = serialize(
            group,
            serializer=StreamGroupSerializerSnuba(stats_period="24h", organization_id=1),
            request=self.make_request(),
        )
        assert serialized["count"] == "1"
        assert serialized["issueCategory"] == "db_query"
        assert serialized["issueType"] == "performance_n_plus_one_db_queries"
        assert [stat[1] for stat in serialized["stats"]["24h"][:-1]] == [0] * 23
        assert serialized["stats"]["24h"][-1][1] == 1

    @freeze_time(before_now(days=1).replace(hour=13, minute=30, second=0, microsecond=0))
    def test_profiling_issue(self) -> None:
        proj = self.create_project()
        cur_time = before_now(minutes=5)
        event, occurrence, group_info = self.store_search_issue(
            proj.id, 1, [f"{ProfileFileIOGroupType.type_id}-group100"], None, cur_time
        )
        assert group_info
        serialized = serialize(
            group_info.group,
            serializer=StreamGroupSerializerSnuba(stats_period="24h", organization_id=1),
            request=self.make_request(),
        )
        assert serialized["count"] == "1"
        assert serialized["issueCategory"] == str(GroupCategory.MOBILE.name).lower()
        assert serialized["issueType"] == str(ProfileFileIOGroupType.slug)
        assert [stat[1] for stat in serialized["stats"]["24h"][:-1]] == [0] * 23
        assert serialized["stats"]["24h"][-1][1] == 1

    def test_get_latest_events_batch(self) -> None:
        """Test that _get_latest_events_batch correctly retrieves latest events for multiple groups."""
        # Create multiple events with different groups
        event1 = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={"timestamp": before_now(seconds=400).isoformat(), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        # Create a newer event for group-1 to test that we get the latest
        event1_newer = self.store_event(
            data={"timestamp": before_now(seconds=300).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )

        serializer = StreamGroupSerializerSnuba(
            stats_period="24h", organization_id=self.organization.id
        )
        groups = [event1.group, event2.group]
        
        # Call the batch method
        latest_events_map = serializer._get_latest_events_batch(groups)
        
        # Verify we got results for both groups
        assert len(latest_events_map) == 2
        assert event1.group.id in latest_events_map
        assert event2.group.id in latest_events_map
        
        # Verify we got the latest event for group-1 (event1_newer, not event1)
        assert latest_events_map[event1.group.id].event_id == event1_newer.event_id
        assert latest_events_map[event2.group.id].event_id == event2.event_id

    def test_get_latest_events_batch_empty(self) -> None:
        """Test that _get_latest_events_batch handles empty list correctly."""
        serializer = StreamGroupSerializerSnuba(
            stats_period="24h", organization_id=self.organization.id
        )
        latest_events_map = serializer._get_latest_events_batch([])
        assert latest_events_map == {}
