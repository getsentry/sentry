from unittest.mock import patch

from sentry import eventstore, eventstream
from sentry.issues.escalating import (
    ParsedGroupsCount,
    get_group_hourly_count,
    query_groups_past_counts,
)
from sentry.models import Group, GroupEnvironment, GroupMeta, GroupRedirect, GroupStatus, UserReport
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus, record_group_history
from sentry.models.groupinbox import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.similarity import _make_index_backend
from sentry.tasks.merge import merge_and_parse_past_counts, merge_groups
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.types.group import GroupSubStatus
from sentry.utils import redis

# Use the default redis client as a cluster client in the similarity index
index = _make_index_backend(redis.clusters.get("default").get_local_client(0))

EXPECTED_MERGED_AND_PARSED_COUNTS: ParsedGroupsCount = {
    3: {
        "intervals": [
            "2023-06-09T11:00:0000000+00:00",
            "2023-06-10T08:00:0000000+00:00",
            "2023-06-10T09:00:0000000+00:00",
            "2023-06-13T08:00:0000000+00:00",
        ],
        "data": [10, 20, 20, 10],
    }
}


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

    def test_merge_query_event_counts(self):
        """
        Test that after merge, events that occur for child group are included in the primary group
        count query response
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

        with self.tasks():
            eventstream_state = eventstream.start_merge(project.id, [child.id], target.id)
            merge_groups([child.id], target.id, handle_forecasts_ids=[target.id, child.id])
            eventstream.end_merge(eventstream_state)

        assert not Group.objects.filter(id=child.id).exists()
        assert Group.objects.filter(id=target.id).exists()

        # Add another event for child group fingerprint, group-2
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

        # Check that the queried target group count includes the child events
        target_hour_count = get_group_hourly_count(target)
        target_past_count = query_groups_past_counts([target])
        assert target_hour_count == 3
        assert target_past_count[0]["count()"] == 3

    def test_merge_and_parse_past_counts(self):
        """
        Test that merge_and_parse_past_counts correctly merges group counts by the hourBucket
        and parses the data into ParsedGroupsCount type.
        """
        groups_count_response = [
            {
                "group_id": 1,
                "hourBucket": "2023-06-10T08:00:0000000+00:00",
                "count()": 10,
                "project_id": 1,
            },
            {
                "group_id": 1,
                "hourBucket": "2023-06-10T09:00:0000000+00:00",
                "count()": 10,
                "project_id": 1,
            },
            {
                "group_id": 1,
                "hourBucket": "2023-06-13T08:00:0000000+00:00",
                "count()": 10,
                "project_id": 1,
            },
            {
                "group_id": 3,
                "hourBucket": "2023-06-09T11:00:0000000+00:00",
                "count()": 10,
                "project_id": 1,
            },
            {
                "group_id": 3,
                "hourBucket": "2023-06-10T08:00:0000000+00:00",
                "count()": 10,
                "project_id": 1,
            },
            {
                "group_id": 3,
                "hourBucket": "2023-06-10T09:00:0000000+00:00",
                "count()": 10,
                "project_id": 1,
            },
        ]
        merged_and_parsed_counts = merge_and_parse_past_counts(
            groups_count_response, primary_group_id=3
        )
        assert merged_and_parsed_counts == EXPECTED_MERGED_AND_PARSED_COUNTS
