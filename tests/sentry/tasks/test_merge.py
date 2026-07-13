from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from sentry import buffer, eventstream
from sentry.issues.models.groupderiveddata import EPOCH, GroupDerivedData
from sentry.models.group import Group
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.groupmeta import GroupMeta
from sentry.models.groupredirect import GroupRedirect
from sentry.models.userreport import UserReport
from sentry.services import eventstore
from sentry.similarity import _make_index_backend, features
from sentry.tasks.merge import merge_groups
from sentry.tasks.post_process import fetch_buffered_group_stats
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.utils import redis

# Use the default redis client as a cluster client in the similarity index
index = _make_index_backend(redis.clusters.get("default").get_local_client(0))


@patch.object(features, "index", new=index)
class MergeGroupTest(TestCase, SnubaTestCase):
    @patch("sentry.eventstream.backend")
    def test_merge_calls_eventstream(self, mock_eventstream) -> None:
        group1 = self.create_group(self.project)
        group2 = self.create_group(self.project)

        eventstream_state: dict[str, Any] = {"key": "value"}

        with self.tasks():
            merge_groups([group1.id], group2.id, eventstream_state=eventstream_state)

        mock_eventstream.end_merge.assert_called_once_with(eventstream_state)

    @patch("sentry.tasks.merge.current_task")
    def test_selfchain_skips_when_already_spawned(self, mock_current_task) -> None:
        # A prior delivery of this activation already spawned its continuation.
        mock_current_task.return_value = SimpleNamespace(id="merge-act-skip")
        mark_spawned("merge_groups", "merge-act-skip")

        with patch.object(merge_groups, "delay") as mock_delay:
            # Ids need not exist: the guard short-circuits before any DB access.
            result = merge_groups([111, 222], 333, transaction_id="txn")

        assert result is True
        assert mock_delay.call_count == 0

    @patch("sentry.tasks.merge.current_task")
    def test_selfchain_marks_and_dedupes_across_deliveries(self, mock_current_task) -> None:
        group1 = self.create_group(self.project)
        group2 = self.create_group(self.project)
        target = self.create_group(self.project)
        mock_current_task.return_value = SimpleNamespace(id="merge-act-dedupe")

        with patch.object(merge_groups, "delay") as mock_delay:
            # First delivery processes group1, leaves group2 -> spawns the continuation once.
            merge_groups([group1.id, group2.id], target.id)
            assert mock_delay.call_count == 1
            assert already_spawned("merge_groups", "merge-act-dedupe") is True

            # Broker re-pend: same activation id, same original payload -> no-op, no new spawn.
            merge_groups([group1.id, group2.id], target.id)
            assert mock_delay.call_count == 1

    @patch("sentry.tasks.merge.mark_spawned")
    @patch("sentry.tasks.merge.current_task", return_value=None)
    def test_selfchain_noop_without_activation(self, mock_current_task, mock_mark) -> None:
        # Synchronous/eager path (e.g. the initial direct call) has no current activation, so the
        # guard is inert and existing behavior is preserved.
        group1 = self.create_group(self.project)
        group2 = self.create_group(self.project)
        target = self.create_group(self.project)

        with patch.object(merge_groups, "delay") as mock_delay:
            merge_groups([group1.id, group2.id], target.id)
            assert mock_delay.call_count == 1

        assert mock_mark.call_count == 0

    def test_merge_group_environments(self) -> None:
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

    def test_merge_with_event_integrity(self) -> None:
        project = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
                "fingerprint": ["group-1"],
                "extra": {"foo": "bar"},
            },
            project_id=project.id,
        )
        group1 = event1.group
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
                "fingerprint": ["group-2"],
                "extra": {"foo": "baz"},
            },
            project_id=project.id,
        )
        group2 = event2.group

        with self.tasks():
            eventstream_state = eventstream.backend.start_merge(project.id, [group1.id], group2.id)
            merge_groups([group1.id], group2.id)
            eventstream.backend.end_merge(eventstream_state)

        assert not Group.objects.filter(id=group1.id).exists()

        event1 = eventstore.backend.get_event_by_id(project.id, event1.event_id)
        assert event1 is not None
        assert event1.group_id == group2.id
        assert event1.data["extra"]["foo"] == "bar"

        event2 = eventstore.backend.get_event_by_id(project.id, event2.event_id)
        assert event2 is not None
        assert event2.group_id == group2.id
        assert event2.data["extra"]["foo"] == "baz"

    def test_merge_creates_redirect(self) -> None:
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

    def test_merge_updates_tag_values_seen(self) -> None:
        project = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
                "fingerprint": ["group-1"],
                "tags": {"foo": "bar"},
                "environment": self.environment.name,
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
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

    def test_merge_with_group_meta(self) -> None:
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

    def test_user_report_merge(self) -> None:
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

    @mock_redis_buffer()
    def test_merge_includes_pending_buffer_increments(self) -> None:
        project = self.create_project()
        old_group = self.create_group(project)
        new_group = self.create_group(project)

        old_group.update(times_seen=100)
        new_group.update(times_seen=50)

        buffer.backend.incr(Group, {"times_seen": 10}, {"id": old_group.id})
        buffer.backend.incr(Group, {"times_seen": 5}, {"id": old_group.id})

        buffer.backend.incr(Group, {"times_seen": 3}, {"id": new_group.id})

        with self.tasks():
            merge_groups([old_group.id], new_group.id)

        assert Group.objects.filter(id=old_group.id).exists() is False

        new_group.refresh_from_db()
        assert new_group.times_seen == 165  # 50 + 100 + 15
        fetch_buffered_group_stats(new_group)
        assert new_group.times_seen_pending == 3
        assert new_group.times_seen_with_pending == 168

    @with_feature("organizations:hard-delete-derived-data-invalidation")
    def test_merge_invalidates_derived_data(self) -> None:
        project = self.create_project()
        old_group = self.create_group(project)
        new_group = self.create_group(project)

        derived = GroupDerivedData.objects.create(
            group=new_group, cursor_date=before_now(minutes=5), cursor_id=100
        )

        with self.tasks():
            merge_groups([old_group.id], new_group.id)

        assert Group.objects.filter(id=old_group.id).exists() is False

        # The derived data is invalidated: the stale row is deleted and rebuilt
        # from scratch by the scheduled processing task.
        rebuilt = GroupDerivedData.objects.get(group_id=new_group.id)
        assert rebuilt.id != derived.id
        assert rebuilt.cursor_date == EPOCH
        assert rebuilt.cursor_id == 0

    @mock_redis_buffer()
    def test_merge_original_group_id(self) -> None:
        project = self.create_project()
        old_group = self.create_group(project)
        new_group = self.create_group(project)

        gale = self.create_group_action_log_entry(group=old_group)

        with self.tasks():
            merge_groups([old_group.id], new_group.id)

        assert Group.objects.filter(id=old_group.id).exists() is False

        gale.refresh_from_db()
        assert gale.group_id == new_group.id
        assert gale.original_group_id == old_group.id
