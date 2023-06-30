from time import sleep
from unittest.mock import Mock, patch

from sentry import eventstore, eventstream
from sentry.issues.escalating import get_group_hourly_count, query_groups_past_counts
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.models import Group, GroupEnvironment, GroupMeta, GroupRedirect, GroupStatus, UserReport
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus, record_group_history
from sentry.models.groupinbox import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.similarity import _make_index_backend
from sentry.tasks.merge import merge_groups, regenerate_primary_group_forecast
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test
from sentry.types.group import GroupSubStatus
from sentry.utils import redis

# Use the default redis client as a cluster client in the similarity index
index = _make_index_backend(redis.clusters.get("default").get_local_client(0))


@patch("sentry.similarity.features.index", new=index)
@region_silo_test
class MergeGroupTest(TestCase, SnubaTestCase):
    @patch("sentry.eventstream.backend")
    def test_merge_calls_eventstream(self, mock_eventstream):
        group1 = self.create_group(self.project)
        group2 = self.create_group(self.project)

        eventstream_state = object()

        with self.tasks():
            merge_groups([group1.id], group2.id, eventstream_state=eventstream_state)

        mock_eventstream.end_merge.assert_called_once_with(eventstream_state)

    def test_merge_group_environments(self):
        group1 = self.create_group(self.project)

        GroupEnvironment.objects.create(group_id=group1.id, environment_id=1)

        group2 = self.create_group(self.project)

        GroupEnvironment.objects.create(group_id=group2.id, environment_id=1)

        GroupEnvironment.objects.create(group_id=group2.id, environment_id=2)

        with self.tasks():
            merge_groups([group1.id], group2.id)

        assert list(
            GroupEnvironment.objects.filter(group_id=group2.id)
            .order_by("environment")
            .values_list("environment_id", flat=True)
        ) == [1, 2]

    def test_merge_with_event_integrity(self):
        project = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-1"],
                "extra": {"foo": "bar"},
            },
            project_id=project.id,
        )
        group1 = event1.group
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-2"],
                "extra": {"foo": "baz"},
            },
            project_id=project.id,
        )
        group2 = event2.group

        with self.tasks():
            eventstream_state = eventstream.backend.start_merge(project.id, [group1.id], group2.id)
            merge_groups([group1.id], group2.id)
            eventstream.end_merge(eventstream_state)

        assert not Group.objects.filter(id=group1.id).exists()

        event1 = eventstore.backend.get_event_by_id(project.id, event1.event_id)
        assert event1.group_id == group2.id
        assert event1.data["extra"]["foo"] == "bar"

        event2 = eventstore.backend.get_event_by_id(project.id, event2.event_id)
        assert event2.group_id == group2.id
        assert event2.data["extra"]["foo"] == "baz"

    def test_merge_creates_redirect(self):
        groups = [self.create_group() for _ in range(0, 3)]

        with self.tasks():
            merge_groups([groups[0].id], groups[1].id)

        assert not Group.objects.filter(id=groups[0].id).exists()
        assert (
            GroupRedirect.objects.filter(
                group_id=groups[1].id, previous_group_id=groups[0].id
            ).count()
            == 1
        )

        with self.tasks():
            merge_groups([groups[1].id], groups[2].id)

        assert not Group.objects.filter(id=groups[1].id).exists()
        assert GroupRedirect.objects.filter(group_id=groups[2].id).count() == 2

    def test_merge_updates_tag_values_seen(self):
        project = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-1"],
                "tags": {"foo": "bar"},
                "environment": self.environment.name,
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-2"],
                "tags": {"foo": "bar"},
                "environment": self.environment.name,
            },
            project_id=project.id,
        )
        target = event1.group
        other = event2.group

        with self.tasks():
            merge_groups([other.id], target.id)

        assert not Group.objects.filter(id=other.id).exists()

    def test_merge_with_group_meta(self):
        project1 = self.create_project()
        event1 = self.store_event(data={}, project_id=project1.id)
        group1 = event1.group

        project2 = self.create_project()
        event2 = self.store_event(data={}, project_id=project2.id)
        group2 = event2.group

        GroupMeta.objects.create(group=event1.group, key="github:tid", value="134")

        GroupMeta.objects.create(group=event1.group, key="other:tid", value="567")

        GroupMeta.objects.create(group=event2.group, key="other:tid", value="abc")

        GroupMeta.objects.populate_cache([group1, group2])

        assert GroupMeta.objects.get_value(group1, "github:tid") == "134"
        assert GroupMeta.objects.get_value(group2, "other:tid") == "abc"
        assert not GroupMeta.objects.get_value(group2, "github:tid")
        assert GroupMeta.objects.get_value(group1, "other:tid") == "567"

        with self.tasks():
            merge_groups([group1.id], group2.id)

        assert not Group.objects.filter(id=group1.id).exists()

        GroupMeta.objects.clear_local_cache()
        GroupMeta.objects.populate_cache([group1, group2])

        assert not GroupMeta.objects.get_value(group1, "github:tid")
        assert not GroupMeta.objects.get_value(group1, "other:tid")
        assert GroupMeta.objects.get_value(group2, "github:tid") == "134"
        assert GroupMeta.objects.get_value(group2, "other:tid") == "abc"

    def test_user_report_merge(self):
        project1 = self.create_project()
        event1 = self.store_event(data={}, project_id=project1.id)
        group1 = event1.group

        project2 = self.create_project()
        group2 = self.create_group(project2)
        ur = UserReport.objects.create(
            project_id=project1.id, group_id=group1.id, event_id=event1.event_id
        )

        with self.tasks():
            merge_groups([group1.id], group2.id)

        assert not Group.objects.filter(id=group1.id).exists()

        assert UserReport.objects.get(id=ur.id).group_id == group2.id

    def test_merge_inherits_from_primary(self):
        """
        Test that on merge, the merged group's GroupStatus, GroupInbox, and GroupHistory
        are inherited from the primary group
        """
        project = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-1"],
                "tags": {"foo": "bar"},
                "environment": self.environment.name,
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-2"],
                "tags": {"foo": "bar"},
                "environment": self.environment.name,
            },
            project_id=project.id,
        )
        target = event1.group
        child = event2.group

        target.status, target.substatus = GroupStatus.IGNORED, GroupSubStatus.UNTIL_ESCALATING
        target.save()
        record_group_history(target, GroupHistoryStatus.ARCHIVED_UNTIL_ESCALATING)
        record_group_history(child, GroupHistoryStatus.ONGOING)
        add_group_to_inbox(target, GroupInboxReason.NEW)
        add_group_to_inbox(child, GroupInboxReason.ONGOING)

        with self.tasks():
            merge_groups([child.id], target.id)

        assert not Group.objects.filter(id=child.id).exists()
        assert Group.objects.filter(id=target.id).exists()
        merged_group = Group.objects.filter(id=target.id)[0]
        assert merged_group.status == GroupStatus.IGNORED
        assert merged_group.substatus == GroupSubStatus.UNTIL_ESCALATING

        assert (
            GroupHistory.objects.filter(group=merged_group)[0].status
            == GroupHistoryStatus.ARCHIVED_UNTIL_ESCALATING
        )
        assert not GroupHistory.objects.filter(group=child)

        assert GroupInbox.objects.filter(group=merged_group)[0].reason == GroupInboxReason.NEW.value
        assert not GroupHistory.objects.filter(group=child)

    @with_feature("organizations:escalating-issues-v2")
    @patch("sentry.tasks.merge.regenerate_primary_group_forecast.apply_async")
    def test_merge_groups_event_counts(self, mock_regenerate_primary_group_forecast: Mock):
        """
        Test that event counts are merged and that child events are added to the primary group
        after merge
        """
        project = self.create_project()
        for i in range(10, 60):
            i_str = str(i)
            event_primary = self.store_event(
                data={
                    "event_id": i_str * 16,
                    "timestamp": iso_format(before_now(seconds=1)),
                    "fingerprint": ["group-1"],
                    "tags": {"foo": "bar"},
                    "environment": self.environment.name,
                },
                project_id=project.id,
            )

        event_child = self.store_event(
            data={
                "event_id": str(60) * 16,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-2"],
                "tags": {"foo": "bar"},
                "environment": self.environment.name,
            },
            project_id=project.id,
        )

        primary = event_primary.group
        child = event_child.group

        generate_and_save_forecasts([primary, child])
        before_merge_hour_count = get_group_hourly_count(primary)
        before_merge_count = query_groups_past_counts([primary])
        assert before_merge_hour_count == 50
        assert before_merge_count[0]["count()"] == 50

        primary.status, primary.substatus = GroupStatus.IGNORED, GroupSubStatus.UNTIL_ESCALATING
        primary.times_seen = 50
        primary.save()

        with self.tasks():
            eventstream_state = eventstream.backend.start_merge(project.id, [child.id], primary.id)
            merge_groups.delay(
                [child.id],
                primary.id,
                eventstream_state=eventstream_state,
                handle_forecasts_ids=[primary.id, child.id],
                merge_forecasts=True,
            )

        # Check that the queried primary group count includes the child event
        sleep(1)  # Sleep for one second to allow snuba to update
        after_merge_hour_count = get_group_hourly_count(primary)
        after_merge_count = query_groups_past_counts([primary])
        assert after_merge_hour_count == 51
        assert after_merge_count[0]["count()"] == 51
        assert mock_regenerate_primary_group_forecast.call_count == 1

        # Add another event after the merge for child group
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-2"],
                "tags": {"foo": "bar"},
                "environment": self.environment.name,
            },
            project_id=project.id,
        )

        # Check that the queried primary group count includes the new child event
        sleep(1)  # Sleep for one second to allow snuba to update
        target_past_count = query_groups_past_counts([primary])
        assert target_past_count[0]["count()"] == 52

    @with_feature("organizations:escalating-issues-v2")
    def test_regenerate_primary_group_forecast(self):
        """
        Test that calling regenerate_primary_group_forecast recalculates the forecast based on the
        new event merged event counts
        """
        project = self.create_project()
        for i in range(10, 60):
            i_str = str(i)
            event_primary = self.store_event(
                data={
                    "event_id": i_str * 16,
                    "timestamp": iso_format(before_now(seconds=1)),
                    "fingerprint": ["group-1"],
                    "tags": {"foo": "bar"},
                    "environment": self.environment.name,
                },
                project_id=project.id,
            )

        event_child = self.store_event(
            data={
                "event_id": str(60) * 16,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-2"],
                "tags": {"foo": "bar"},
                "environment": self.environment.name,
            },
            project_id=project.id,
        )

        primary = event_primary.group
        child = event_child.group

        generate_and_save_forecasts([primary, child])
        before_merge_forecast = EscalatingGroupForecast.fetch(
            primary.project.id, primary.id
        ).forecast

        with self.tasks():
            eventstream_state = eventstream.backend.start_merge(project.id, [child.id], primary.id)
            merge_groups.delay(
                [child.id],
                primary.id,
                eventstream_state=eventstream_state,
                handle_forecasts_ids=[primary.id, child.id],
                merge_forecasts=True,
            )
        regenerate_primary_group_forecast(primary.id)
        after_merge_forecast = EscalatingGroupForecast.fetch(
            primary.project.id, primary.id
        ).forecast
        assert before_merge_forecast != after_merge_forecast
