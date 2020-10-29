from __future__ import absolute_import

from sentry.utils.compat.mock import patch

from sentry.tasks.merge import merge_groups
from sentry.models import Group, GroupEnvironment, GroupMeta, GroupRedirect, UserReport
from sentry.similarity import _make_index_backend
from sentry.testutils import TestCase
from sentry.utils import redis
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry import eventstream, eventstore

# Use the default redis client as a cluster client in the similarity index
index = _make_index_backend(redis.clusters.get("default").get_local_client(0))


@patch("sentry.similarity.features.index", new=index)
class MergeGroupTest(TestCase):
    @patch("sentry.tasks.merge.eventstream")
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
            eventstream_state = eventstream.start_merge(project.id, [group1.id], group2.id)
            merge_groups([group1.id], group2.id)
            eventstream.end_merge(eventstream_state)

        assert not Group.objects.filter(id=group1.id).exists()

        event1 = eventstore.get_event_by_id(project.id, event1.event_id)
        assert event1.group_id == group2.id
        assert event1.data["extra"]["foo"] == "bar"

        event2 = eventstore.get_event_by_id(project.id, event2.event_id)
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
        ur = UserReport.objects.create(project=project1, group=group1, event_id=event1.event_id)

        with self.tasks():
            merge_groups([group1.id], group2.id)

        assert not Group.objects.filter(id=group1.id).exists()

        assert UserReport.objects.get(id=ur.id).group_id == group2.id
