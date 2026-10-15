from datetime import timedelta
from itertools import chain, repeat
from unittest.mock import Mock, patch

import pytest
from django.db import OperationalError, connections, router
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from psycopg2.errors import LockNotAvailable, QueryCanceled
from taskbroker_client.retry import RetryTaskError
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.issues.action_log import SYSTEM_ACTOR, ActionSource, action_context_scope
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release, ReleaseStatus
from sentry.tasks.clear_expired_resolutions import (
    _clear_finalized_resolutions,
    clear_expired_resolutions,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.features import Feature, with_feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.activity import ActivityType


@django_db_all
@pytest.mark.parametrize("finalized_order", [False, True], ids=["flag-off", "flag-on"])
@pytest.mark.parametrize(
    "activity_data, expected_data",
    [
        pytest.param(None, {"version": "next"}, id="null-data"),
        pytest.param(
            {"version": "", "current_release_version": "anchor"},
            {"version": "next", "current_release_version": "anchor"},
            id="existing-metadata",
        ),
    ],
)
def test_activity_preserves_resolution_metadata(
    factories: Factories,
    default_group: Group,
    finalized_order: bool,
    activity_data: dict[str, str] | None,
    expected_data: dict[str, str],
) -> None:
    now = timezone.now()
    project = default_group.project
    anchor = factories.create_release(
        project=project, version="anchor", date_added=now - timedelta(days=3)
    )
    resolution = factories.create_group_resolution(
        group=default_group,
        release=anchor,
        current_release_version=anchor.version,
        type=GroupResolution.Type.in_next_release,
        status=GroupResolution.Status.pending,
    )
    with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
        activity = Activity.objects.create_group_activity(
            default_group,
            ActivityType.SET_RESOLVED_IN_RELEASE,
            ident=resolution.id,
            data={"version": ""},
        )
    # Existing activity rows can have null data.
    activity.update(data=activity_data)
    next_release = factories.create_release(
        project=project, version="next", date_added=now - timedelta(days=1)
    )

    with Feature({"organizations:release-resolution-finalized-order": finalized_order}):
        clear_expired_resolutions(next_release.id)

    activity.refresh_from_db()
    assert activity.data == expected_data
    resolution.refresh_from_db()
    assert resolution.release_id == next_release.id
    assert resolution.type == GroupResolution.Type.in_release
    assert resolution.status == GroupResolution.Status.resolved


@django_db_all
@pytest.mark.parametrize("finalized_order", [False, True], ids=["flag-off", "flag-on"])
@pytest.mark.parametrize("successor_status", [ReleaseStatus.OPEN, None], ids=["open", "null"])
def test_archived_release_does_not_expire_resolution(
    factories: Factories,
    default_group: Group,
    finalized_order: bool,
    successor_status: int | None,
) -> None:
    now = timezone.now()
    project = default_group.project
    anchor = factories.create_release(
        project=project, version="anchor", date_added=now - timedelta(days=3)
    )
    resolution = factories.create_group_resolution(
        group=default_group,
        release=anchor,
        current_release_version=anchor.version,
        type=GroupResolution.Type.in_next_release,
        status=GroupResolution.Status.pending,
    )
    with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
        activity = Activity.objects.create_group_activity(
            default_group,
            ActivityType.SET_RESOLVED_IN_RELEASE,
            ident=resolution.id,
            data={"version": "", "current_release_version": anchor.version},
        )
    archived = factories.create_release(
        project=project,
        version="archived-successor",
        date_added=now - timedelta(days=2),
        status=ReleaseStatus.ARCHIVED,
    )
    with Feature({"organizations:release-resolution-finalized-order": finalized_order}):
        clear_expired_resolutions(archived.id)

    resolution.refresh_from_db()
    activity.refresh_from_db()
    assert resolution.release_id == anchor.id
    assert resolution.type == GroupResolution.Type.in_next_release
    assert resolution.status == GroupResolution.Status.pending
    assert activity.data == {"version": "", "current_release_version": anchor.version}

    successor = factories.create_release(
        project=project,
        version="eligible-successor",
        date_added=now - timedelta(days=1),
        status=successor_status,
    )
    with Feature({"organizations:release-resolution-finalized-order": finalized_order}):
        clear_expired_resolutions(successor.id)

    resolution.refresh_from_db()
    activity.refresh_from_db()
    assert resolution.release_id == successor.id
    assert resolution.type == GroupResolution.Type.in_release
    assert resolution.status == GroupResolution.Status.resolved
    assert resolution.current_release_version == anchor.version
    assert activity.data == {
        "version": successor.version,
        "current_release_version": anchor.version,
    }


class ClearExpiredResolutionsTest(TestCase):
    def test_task_persistent_name(self) -> None:
        assert clear_expired_resolutions.name == "sentry.tasks.clear_expired_resolutions"
        retry = clear_expired_resolutions.retry
        assert retry is not None
        state = retry.initial_state()
        assert retry.should_retry(state, ProcessingDeadlineExceeded())
        assert retry.should_retry(state, RetryTaskError())
        state.attempts = state.max_attempts - 1
        assert not retry.should_retry(state, ProcessingDeadlineExceeded())

    def test_simple(self) -> None:
        project = self.create_project()

        old_release = Release.objects.create(organization_id=project.organization_id, version="a")
        old_release.add_project(project)

        group1 = self.create_group(
            project=project, status=GroupStatus.RESOLVED, active_at=timezone.now()
        )
        resolution1 = GroupResolution.objects.create(
            group=group1, release=old_release, type=GroupResolution.Type.in_next_release
        )
        activity1 = Activity.objects.create(
            group=group1,
            project=project,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution1.id,
            data={"version": ""},
        )

        new_release = Release.objects.create(
            organization_id=project.organization_id,
            version="b",
            date_added=timezone.now() + timedelta(minutes=1),
        )
        new_release.add_project(project)

        group2 = self.create_group(status=GroupStatus.UNRESOLVED, active_at=timezone.now())
        resolution2 = GroupResolution.objects.create(
            group=group2, release=new_release, type=GroupResolution.Type.in_next_release
        )
        activity2 = Activity.objects.create(
            group=group2,
            project=project,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution2.id,
            data={"version": ""},
        )

        clear_expired_resolutions(new_release.id)

        assert Group.objects.get(id=group1.id).status == GroupStatus.RESOLVED

        assert Group.objects.get(id=group2.id).status == GroupStatus.UNRESOLVED

        # row should be updated to the in_release type, and reflect
        # the release it was resolved in
        resolution1 = GroupResolution.objects.get(id=resolution1.id)
        assert resolution1.status == GroupResolution.Status.resolved
        assert resolution1.release == new_release
        assert resolution1.type == GroupResolution.Type.in_release

        resolution2 = GroupResolution.objects.get(id=resolution2.id)
        assert resolution2.status == GroupResolution.Status.pending

        activity1 = Activity.objects.get(id=activity1.id)
        assert activity1.data["version"] == new_release.version

        activity2 = Activity.objects.get(id=activity2.id)
        assert activity2.data["version"] == ""

    @with_feature("organizations:release-resolution-finalized-order")
    def test_finalized_release_order_prevents_old_release_from_expiring_resolution(self) -> None:
        now = timezone.now()
        project = self.create_project()
        resolution_release = self.create_release(
            project=project,
            version="resolution-release",
            date_added=now - timedelta(minutes=30),
            date_released=now - timedelta(minutes=10),
        )
        late_registered_old_release = self.create_release(
            project=project,
            version="old-release",
            date_added=now,
            date_released=now - timedelta(minutes=60),
        )
        group = self.create_group(project=project, status=GroupStatus.RESOLVED)
        resolution = self.create_group_resolution(
            group=group,
            release=resolution_release,
            type=GroupResolution.Type.in_next_release,
            status=GroupResolution.Status.pending,
        )

        clear_expired_resolutions(late_registered_old_release.id)

        resolution.refresh_from_db()
        assert resolution.release == resolution_release
        assert resolution.type == GroupResolution.Type.in_next_release
        assert resolution.status == GroupResolution.Status.pending

    @with_feature("organizations:release-resolution-finalized-order")
    def test_finalized_release_order_expires_older_resolution(self) -> None:
        now = timezone.now()
        project = self.create_project()
        resolution_release = self.create_release(
            project=project,
            version="resolution-release",
            date_added=now,
            date_released=now - timedelta(minutes=60),
        )
        next_release = self.create_release(
            project=project,
            version="next-release",
            date_added=now - timedelta(minutes=30),
            date_released=now - timedelta(minutes=10),
        )
        group = self.create_group(project=project, status=GroupStatus.RESOLVED)
        resolution = self.create_group_resolution(
            group=group,
            release=resolution_release,
            type=GroupResolution.Type.in_next_release,
            status=GroupResolution.Status.pending,
        )

        clear_expired_resolutions(next_release.id)

        resolution.refresh_from_db()
        assert resolution.release == next_release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.status == GroupResolution.Status.resolved


@with_feature("organizations:release-resolution-finalized-order")
class FinalizedResolutionTaskTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.now = timezone.now()
        self.anchor = self.create_release(version="anchor", date_added=self.now - timedelta(days=3))
        self.group = self.create_group(project=self.project, status=GroupStatus.RESOLVED)
        self.resolution = self.create_group_resolution(
            group=self.group,
            release=self.anchor,
            current_release_version=self.anchor.version,
            type=GroupResolution.Type.in_next_release,
            status=GroupResolution.Status.pending,
        )

    def test_chooses_earliest_successor_when_tasks_arrive_out_of_order(self) -> None:
        next_release = self.create_release(version="next", date_added=self.now - timedelta(days=2))
        later_release = self.create_release(
            version="later", date_added=self.now - timedelta(days=1)
        )
        clear_expired_resolutions(later_release.id)
        self.resolution.refresh_from_db()
        assert self.resolution.release_id == next_release.id
        assert self.resolution.current_release_version == self.anchor.version
        assert self.resolution.status == GroupResolution.Status.resolved

        clear_expired_resolutions(next_release.id)
        clear_expired_resolutions(later_release.id)
        self.resolution.refresh_from_db()
        assert self.resolution.release_id == next_release.id

    def test_archived_anchor_date_edit_finds_existing_successor(self) -> None:
        existing = self.create_release(version="existing", date_added=self.now - timedelta(days=4))
        self.anchor.update(status=ReleaseStatus.ARCHIVED)
        self.anchor.update(date_released=self.now - timedelta(days=5))
        clear_expired_resolutions(self.anchor.id)
        self.resolution.refresh_from_db()
        assert self.resolution.release_id == existing.id
        assert self.resolution.status == GroupResolution.Status.resolved

    def test_anchor_with_no_successor_stays_pending(self) -> None:
        clear_expired_resolutions(self.anchor.id)
        self.resolution.refresh_from_db()
        assert self.resolution.release_id == self.anchor.id
        assert self.resolution.status == GroupResolution.Status.pending

    def test_shared_release_does_not_resolve_other_projects(self) -> None:
        other_project = self.create_project(organization=self.organization)
        self.anchor.add_project(other_project)
        other_group = self.create_group(project=other_project, status=GroupStatus.RESOLVED)
        other_resolution = self.create_group_resolution(
            group=other_group,
            release=self.anchor,
            type=GroupResolution.Type.in_next_release,
            status=GroupResolution.Status.pending,
        )
        next_release = self.create_release(version="next", date_added=self.now - timedelta(days=1))
        clear_expired_resolutions(next_release.id)
        self.resolution.refresh_from_db()
        other_resolution.refresh_from_db()
        assert self.resolution.release_id == next_release.id
        assert other_resolution.status == GroupResolution.Status.pending

    def test_existing_resolved_assignment_is_not_rewritten(self) -> None:
        self.resolution.update(
            type=GroupResolution.Type.in_release, status=GroupResolution.Status.resolved
        )
        next_release = self.create_release(version="next", date_added=self.now - timedelta(days=1))
        clear_expired_resolutions(next_release.id)
        self.resolution.refresh_from_db()
        assert self.resolution.release_id == self.anchor.id

    def test_equal_dates_use_release_id_to_select_successor(self) -> None:
        next_release = self.create_release(version="same-date", date_added=self.anchor.date_added)
        clear_expired_resolutions(next_release.id)
        self.resolution.refresh_from_db()
        assert self.resolution.release_id == next_release.id

    def test_batches_advance_past_pending_rows_without_successors(self) -> None:
        other_project = self.create_project(organization=self.organization)
        self.anchor.add_project(other_project)
        successor = self.create_release(project=other_project, version="other-project-successor")
        other_group = self.create_group(project=other_project, status=GroupStatus.RESOLVED)
        other_resolution = self.create_group_resolution(
            group=other_group,
            release=self.anchor,
            type=GroupResolution.Type.in_next_release,
            status=GroupResolution.Status.pending,
        )
        with (
            patch("sentry.tasks.clear_expired_resolutions.RESOLUTION_BATCH_SIZE", 1),
            patch.object(clear_expired_resolutions, "apply_async_with_future") as publish,
        ):
            clear_expired_resolutions(self.anchor.id)
            publish.assert_called_once_with(
                kwargs={"release_id": self.anchor.id, "after_id": self.resolution.id}
            )
            publish.return_value.result.assert_called_once_with(timeout=3)
            self.resolution.refresh_from_db()
            other_resolution.refresh_from_db()
            assert self.resolution.status == GroupResolution.Status.pending
            assert other_resolution.status == GroupResolution.Status.pending

            publish.reset_mock()
            clear_expired_resolutions(self.anchor.id, after_id=self.resolution.id)
            other_resolution.refresh_from_db()
            assert other_resolution.release_id == successor.id
            assert other_resolution.status == GroupResolution.Status.resolved
            publish.assert_called_once_with(
                kwargs={"release_id": self.anchor.id, "after_id": other_resolution.id}
            )

            publish.reset_mock()
            clear_expired_resolutions(self.anchor.id, after_id=other_resolution.id)
            publish.assert_not_called()

    def test_time_budget_commits_progress_and_continuation_obeys_killswitch(self) -> None:
        successor = self.create_release(version="next")
        other_group = self.create_group(project=self.project, status=GroupStatus.RESOLVED)
        other_resolution = self.create_group_resolution(
            group=other_group, release=self.anchor, type=GroupResolution.Type.in_next_release
        )
        with (
            patch(
                "sentry.tasks.clear_expired_resolutions.monotonic",
                side_effect=chain([0], repeat(4)),
            ),
            patch.object(clear_expired_resolutions, "apply_async_with_future") as publish,
        ):
            clear_expired_resolutions(successor.id)
            publish.assert_called_once_with(
                kwargs={"release_id": successor.id, "after_id": self.resolution.id}
            )
        self.resolution.refresh_from_db()
        other_resolution.refresh_from_db()
        assert self.resolution.status == GroupResolution.Status.resolved
        assert other_resolution.status == GroupResolution.Status.pending
        with Feature({"organizations:release-resolution-finalized-order": False}):
            clear_expired_resolutions(successor.id, after_id=self.resolution.id)
        other_resolution.refresh_from_db()
        assert other_resolution.status == GroupResolution.Status.pending
        clear_expired_resolutions(successor.id, after_id=self.resolution.id)
        other_resolution.refresh_from_db()
        assert other_resolution.release_id == successor.id

    def test_failed_activity_write_rolls_back_and_retry_finishes(self) -> None:
        successor = self.create_release(version="next")
        with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
            activity = Activity.objects.create_group_activity(
                self.group,
                ActivityType.SET_RESOLVED_IN_RELEASE,
                ident=self.resolution.id,
                data={"version": "", "current_release_version": self.anchor.version},
            )

        def slow_activity_write(execute, sql, params, many, context):
            if sql.startswith('UPDATE "sentry_activity"'):
                return execute("SELECT pg_sleep(2)", None, False, context)
            return execute(sql, params, many, context)

        connection = connections[router.db_for_write(GroupResolution)]
        with (
            connection.execute_wrapper(slow_activity_write),
            patch.object(clear_expired_resolutions, "apply_async_with_future") as publish,
            patch("sentry.tasks.clear_expired_resolutions.logger") as logger,
            patch("sentry.tasks.clear_expired_resolutions.metrics.incr") as incr,
            patch(
                "sentry.tasks.clear_expired_resolutions.current_task",
                return_value=Mock(retries_remaining=False),
            ),
            pytest.raises(RetryTaskError) as error,
        ):
            clear_expired_resolutions(successor.id)
        assert isinstance(error.value.__cause__, OperationalError)
        assert isinstance(error.value.__cause__.__cause__, QueryCanceled)
        logger.exception.assert_not_called()
        assert logger.warning.call_args.kwargs["extra"]["phase"] == "write"
        incr.assert_any_call(
            "releases.resolution_batch.exhausted",
            tags={"phase": "write", "error": "statement_timeout"},
            sample_rate=1.0,
        )
        publish.assert_not_called()
        self.resolution.refresh_from_db()
        activity.refresh_from_db()
        assert self.resolution.status == GroupResolution.Status.pending
        assert activity.data["version"] == ""
        clear_expired_resolutions(successor.id)
        self.resolution.refresh_from_db()
        activity.refresh_from_db()
        assert self.resolution.release_id == successor.id
        assert activity.data == {
            "version": successor.version,
            "current_release_version": self.anchor.version,
        }

    def test_failed_continuation_delivery_can_replay_committed_page(self) -> None:
        successor = self.create_release(version="next")
        other_group = self.create_group(project=self.project, status=GroupStatus.RESOLVED)
        other_resolution = self.create_group_resolution(
            group=other_group, release=self.anchor, type=GroupResolution.Type.in_next_release
        )
        with (
            patch("sentry.tasks.clear_expired_resolutions.RESOLUTION_BATCH_SIZE", 1),
            patch.object(clear_expired_resolutions, "apply_async_with_future") as publish,
        ):
            publish.return_value.result.side_effect = TimeoutError("delivery failed")
            with (
                patch("sentry.tasks.clear_expired_resolutions.logger") as logger,
                pytest.raises(RetryTaskError),
            ):
                clear_expired_resolutions(successor.id)
            logger.exception.assert_called_once()
            assert logger.exception.call_args.kwargs["extra"]["phase"] == "publish"
            assert logger.exception.call_args.kwargs["extra"]["error"] == "other"
            self.resolution.refresh_from_db()
            other_resolution.refresh_from_db()
            assert self.resolution.status == GroupResolution.Status.resolved
            assert other_resolution.status == GroupResolution.Status.pending

            publish.return_value.result.side_effect = None
            clear_expired_resolutions(successor.id)
            other_resolution.refresh_from_db()
            assert other_resolution.release_id == successor.id
            assert other_resolution.status == GroupResolution.Status.resolved
            clear_expired_resolutions(successor.id, after_id=other_resolution.id)


@django_db_all(transaction=True)
def test_batch_commits_and_releases_locks_before_publishing(
    factories: Factories, default_group: Group
) -> None:
    project = default_group.project
    anchor = factories.create_release(project=project, version="anchor")
    successor = factories.create_release(project=project, version="next")
    group = factories.create_group(project=project, status=GroupStatus.RESOLVED)
    resolution = factories.create_group_resolution(
        group=group, release=anchor, type=GroupResolution.Type.in_next_release
    )
    connection = connections[router.db_for_write(GroupResolution)]
    with connection.cursor() as cursor:
        cursor.execute("SHOW statement_timeout")
        original_timeout = cursor.fetchone()[0]

    def publish_after_commit(**kwargs):
        assert not connection.in_atomic_block
        resolution.refresh_from_db()
        assert resolution.status == GroupResolution.Status.resolved
        with connection.cursor() as cursor:
            cursor.execute("SHOW statement_timeout")
            assert cursor.fetchone()[0] == original_timeout
        return Mock()

    with (
        Feature({"organizations:release-resolution-finalized-order": True}),
        patch("sentry.tasks.clear_expired_resolutions.RESOLUTION_BATCH_SIZE", 1),
        patch.object(
            clear_expired_resolutions, "apply_async_with_future", side_effect=publish_after_commit
        ) as publish,
    ):
        clear_expired_resolutions(successor.id)
    publish.assert_called_once_with(kwargs={"release_id": successor.id, "after_id": resolution.id})


@django_db_all(transaction=True)
def test_lock_contention_retries_and_preserves_manual_resolution(
    factories: Factories, default_group: Group
) -> None:
    project = default_group.project
    anchor = factories.create_release(project=project, version="anchor")
    successor = factories.create_release(project=project, version="next")
    manual = factories.create_release(project=project, version="manual")
    resolution = factories.create_group_resolution(
        group=default_group, release=anchor, type=GroupResolution.Type.in_next_release
    )
    other_group = factories.create_group(project=project)
    other_resolution = factories.create_group_resolution(
        group=other_group, release=anchor, type=GroupResolution.Type.in_next_release
    )
    connection = connections[router.db_for_write(GroupResolution)]
    competing = connection.copy()
    try:
        competing.set_autocommit(False)
        with competing.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM sentry_groupresolution WHERE id = %s FOR UPDATE", [resolution.id]
            )
            with (
                Feature({"organizations:release-resolution-finalized-order": True}),
                patch("sentry.tasks.clear_expired_resolutions.logger") as logger,
                pytest.raises(RetryTaskError) as error,
            ):
                clear_expired_resolutions(successor.id)
            assert isinstance(error.value.__cause__, OperationalError)
            assert isinstance(error.value.__cause__.__cause__, LockNotAvailable)
            logger.exception.assert_not_called()
            assert logger.warning.call_args.kwargs["extra"]["error"] == "lock_timeout"
            other_resolution.refresh_from_db()
            assert other_resolution.status == GroupResolution.Status.pending
            cursor.execute(
                "UPDATE sentry_groupresolution SET release_id = %s, status = 1, type = 0 WHERE id = %s",
                [manual.id, resolution.id],
            )
        competing.commit()
    finally:
        competing.close()

    with Feature({"organizations:release-resolution-finalized-order": True}):
        clear_expired_resolutions(successor.id)
    resolution.refresh_from_db()
    other_resolution.refresh_from_db()
    assert resolution.release_id == manual.id
    assert other_resolution.release_id == successor.id
    assert other_resolution.status == GroupResolution.Status.resolved


@django_db_all
@pytest.mark.parametrize("anchor_count", [1, 20])
def test_batch_query_cost_and_activity_matching(
    factories: Factories, default_group: Group, anchor_count: int
) -> None:
    project = default_group.project
    now = timezone.now()
    anchors = [
        factories.create_release(
            project=project, version=f"anchor-{i}", date_added=now - timedelta(days=2, minutes=i)
        )
        for i in range(anchor_count)
    ]
    successor = factories.create_release(project=project, version="next", date_added=now)
    expected_versions = {
        anchor.id: Release.objects.get_next_release(
            project, anchor, use_finalized_order=True
        ).version
        for anchor in anchors
    }
    groups = [factories.create_group(project=project) for _ in range(100)]
    resolutions = [
        factories.create_group_resolution(
            group=group,
            release=anchors[i % anchor_count],
            type=GroupResolution.Type.in_next_release,
            current_release_version=anchors[i % anchor_count].version,
        )
        for i, group in enumerate(groups)
    ]
    expected_activity_versions = [expected_versions[r.release_id] for r in resolutions]
    with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
        activities = [
            Activity.objects.create_group_activity(
                group,
                ActivityType.SET_RESOLVED_IN_RELEASE,
                ident=resolution.id,
                data={"version": "", "current_release_version": resolution.current_release_version},
                send_notification=False,
            )
            for group, resolution in zip(groups[:-1], resolutions[:-1])
        ]
        # Equal timestamps still update just one latest matching activity.
        duplicate = Activity.objects.create_group_activity(
            groups[1],
            ActivityType.SET_RESOLVED_IN_RELEASE,
            ident=resolutions[1].id,
            data={"version": "", "preserve": True},
            datetime=activities[1].datetime,
            send_notification=False,
        )
        unrelated = Activity.objects.create_group_activity(
            groups[0],
            ActivityType.SET_RESOLVED_IN_RELEASE,
            ident="unrelated",
            data={"version": "unchanged"},
            send_notification=False,
        )
    activities[0].update(data=None)
    connection = connections[router.db_for_write(GroupResolution)]
    with (
        CaptureQueriesContext(connection) as queries,
        patch("sentry.tasks.clear_expired_resolutions.monotonic", return_value=0),
    ):
        cursor = _clear_finalized_resolutions(successor)
    assert cursor.next_cursor == resolutions[-1].id
    assert cursor.retry_ids == []
    data_queries = [q["sql"] for q in queries if q["sql"].startswith(("SELECT", "UPDATE"))]
    # Candidate read and recheck, one lookup per anchor, and three bulk operations.
    assert len(data_queries) == anchor_count + 5
    assert len([sql for sql in data_queries if sql.startswith('UPDATE "sentry_activity"')]) == 1
    assert (
        len([sql for sql in data_queries if sql.startswith('UPDATE "sentry_groupresolution"')]) == 1
    )
    assert '"sentry_groupedmessage"."data"' not in data_queries[0]
    assert (
        list(
            GroupResolution.objects.filter(id__in=[r.id for r in resolutions])
            .order_by("id")
            .values_list("release__version", flat=True)
        )
        == expected_activity_versions
    )
    assert not GroupResolution.objects.filter(
        id__in=[r.id for r in resolutions], status=GroupResolution.Status.pending
    ).exists()
    activities[0].refresh_from_db()
    activities[1].refresh_from_db()
    activities[2].refresh_from_db()
    duplicate.refresh_from_db()
    unrelated.refresh_from_db()
    assert activities[0].data == {"version": expected_activity_versions[0]}
    assert activities[1].data["version"] == ""
    assert activities[2].data == {
        "version": expected_activity_versions[2],
        "current_release_version": resolutions[2].current_release_version,
    }
    assert duplicate.data == {"version": expected_activity_versions[1], "preserve": True}
    assert unrelated.data == {"version": "unchanged"}


@django_db_all(transaction=True)
def test_slow_successor_retries_do_not_strand_later_pages(
    factories: Factories, default_group: Group
) -> None:
    project = default_group.project
    slow_anchor = factories.create_release(project=project, version="slow-anchor")
    healthy_anchor = factories.create_release(project=project, version="healthy-anchor")
    successor = factories.create_release(project=project, version="next")
    slow = factories.create_group_resolution(
        group=default_group, release=slow_anchor, type=GroupResolution.Type.in_next_release
    )
    healthy = [
        factories.create_group_resolution(
            group=factories.create_group(project=project),
            release=healthy_anchor,
            type=GroupResolution.Type.in_next_release,
        )
        for _ in range(11)
    ]
    connection = connections[router.db_for_write(GroupResolution)]
    competing = connection.copy()

    def slow_successor(execute, sql, params, many, context):
        if sql.startswith('SELECT "sentry_release"."id"') and slow_anchor.id in params:
            # A second connection can lock the resolution while the lookup runs.
            # This would fail if successor selection still held resolution locks.
            with competing.cursor() as cursor:
                cursor.execute(
                    "SELECT id FROM sentry_groupresolution WHERE id = %s FOR UPDATE NOWAIT",
                    [slow.id],
                )
            return execute("SELECT pg_sleep(2)", None, False, context)
        return execute(sql, params, many, context)

    try:
        with (
            Feature({"organizations:release-resolution-finalized-order": True}),
            connection.execute_wrapper(slow_successor),
            patch("sentry.tasks.clear_expired_resolutions.RESOLUTION_BATCH_SIZE", 2),
            patch("sentry.tasks.clear_expired_resolutions.monotonic", return_value=0),
            patch.object(clear_expired_resolutions, "apply_async_with_future") as publish,
            patch("sentry.tasks.clear_expired_resolutions.logger") as logger,
            patch("sentry.tasks.clear_expired_resolutions.metrics.incr") as incr,
        ):
            clear_expired_resolutions(successor.id)
            retry_kwargs = publish.call_args_list[0].kwargs["kwargs"]
            assert retry_kwargs == {
                "release_id": successor.id,
                "after_id": 0,
                "resolution_ids": [slow.id],
            }
            next_kwargs = publish.call_args_list[1].kwargs["kwargs"]
            healthy[0].refresh_from_db()
            assert healthy[0].release_id == successor.id

            # More pages than retry attempts: the failing row cannot block them.
            for _ in range(5):
                clear_expired_resolutions(**next_kwargs)
                next_kwargs = publish.call_args.kwargs["kwargs"]
            clear_expired_resolutions(**next_kwargs)
            assert GroupResolution.objects.filter(
                id__in=[r.id for r in healthy], status=GroupResolution.Status.resolved
            ).count() == len(healthy)

            publish.reset_mock()
            for attempt in range(5):
                with (
                    patch(
                        "sentry.tasks.clear_expired_resolutions.current_task",
                        return_value=Mock(retries_remaining=attempt < 4),
                    ),
                    pytest.raises(RetryTaskError),
                ):
                    clear_expired_resolutions(**retry_kwargs)
            publish.assert_not_called()  # Retries never spawn more retries or pages.
            logger.exception.assert_not_called()
            incr.assert_any_call(
                "releases.resolution_batch.failed",
                tags={"phase": "successor", "error": "statement_timeout"},
                sample_rate=1.0,
            )
            incr.assert_any_call(
                "releases.resolution_batch.exhausted",
                tags={"phase": "successor", "error": "statement_timeout"},
                sample_rate=1.0,
            )
            assert logger.warning.call_args.kwargs["extra"]["resolution_ids"] == [slow.id]
            assert logger.warning.call_args.args[0] == "releases.resolution_batch.exhausted"
            slow.refresh_from_db()
            assert slow.status == GroupResolution.Status.pending

        with Feature({"organizations:release-resolution-finalized-order": False}):
            clear_expired_resolutions(**retry_kwargs)
        slow.refresh_from_db()
        assert slow.status == GroupResolution.Status.pending
        # The recorded arguments support recovery once the slow lookup is fixed.
        with Feature({"organizations:release-resolution-finalized-order": True}):
            clear_expired_resolutions(**retry_kwargs)
        slow.refresh_from_db()
        assert slow.release_id == healthy_anchor.id
    finally:
        competing.close()


@django_db_all(transaction=True)
def test_revalidation_preserves_concurrent_resolution_changes(
    factories: Factories, default_group: Group
) -> None:
    now = timezone.now()
    projects = [
        factories.create_project(organization=default_group.project.organization) for _ in range(5)
    ]
    anchors = [
        factories.create_release(
            project=p, version=f"anchor-{i}", date_added=now - timedelta(days=2)
        )
        for i, p in enumerate(projects)
    ]
    groups = [factories.create_group(project=p) for p in projects]
    resolutions = [
        factories.create_group_resolution(
            group=g, release=a, type=GroupResolution.Type.in_next_release
        )
        for g, a in zip(groups, anchors)
    ]
    successor = factories.create_release(project=projects[0], version="next", date_added=now)
    for project in projects[1:]:
        successor.add_project(project)
    replacement = factories.create_release(
        project=projects[0], version="replacement", date_added=now - timedelta(days=1)
    )
    connection = connections[router.db_for_write(GroupResolution)]
    new_activities = []

    def change_before_lock(execute, sql, params, many, context):
        result = execute(sql, params, many, context)
        if sql.startswith('SELECT "sentry_release"."id"') and anchors[-1].id in params:
            resolutions[0].update(release=replacement, datetime=timezone.now())
            anchors[1].update(date_released=now + timedelta(days=1))
            resolutions[2].update(datetime=timezone.now())
            with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
                new_activities.append(
                    Activity.objects.create_group_activity(
                        groups[2],
                        ActivityType.SET_RESOLVED_IN_RELEASE,
                        ident=resolutions[2].id,
                        data={"version": "", "preserve": True},
                    )
                )
            GroupResolution.objects.filter(id=resolutions[3].id).delete()
            resolutions[4].update(
                status=GroupResolution.Status.resolved, type=GroupResolution.Type.in_release
            )
        return result

    with (
        Feature({"organizations:release-resolution-finalized-order": True}),
        connection.execute_wrapper(change_before_lock),
        patch.object(clear_expired_resolutions, "apply_async_with_future") as publish,
    ):
        clear_expired_resolutions(successor.id)
    publish.assert_called_once_with(
        kwargs={
            "release_id": successor.id,
            "after_id": 0,
            "resolution_ids": [resolutions[0].id, resolutions[1].id],
        }
    )
    for resolution in resolutions[:3] + resolutions[4:]:
        resolution.refresh_from_db()
    assert resolutions[0].release_id == replacement.id
    assert resolutions[0].status == GroupResolution.Status.pending
    assert resolutions[1].status == GroupResolution.Status.pending
    assert resolutions[2].release_id == successor.id
    assert not GroupResolution.objects.filter(id=resolutions[3].id).exists()
    assert resolutions[4].release_id == anchors[4].id
    assert resolutions[4].status == GroupResolution.Status.resolved
    new_activities[0].refresh_from_db()
    assert new_activities[0].data == {"version": successor.version, "preserve": True}
    with Feature({"organizations:release-resolution-finalized-order": True}):
        clear_expired_resolutions(**publish.call_args.kwargs["kwargs"])
    resolutions[0].refresh_from_db()
    resolutions[1].refresh_from_db()
    assert resolutions[0].release_id == successor.id
    assert resolutions[1].status == GroupResolution.Status.pending


@django_db_all
def test_unexpected_successor_failure_retries_without_advancing(
    factories: Factories, default_group: Group
) -> None:
    anchor = factories.create_release(project=default_group.project, version="anchor")
    successor = factories.create_release(project=default_group.project, version="next")
    resolution = factories.create_group_resolution(
        group=default_group, release=anchor, type=GroupResolution.Type.in_next_release
    )
    with (
        Feature({"organizations:release-resolution-finalized-order": True}),
        patch.object(
            Release.objects,
            "get_next_release_queryset",
            side_effect=OperationalError("connection failed"),
        ),
        patch.object(clear_expired_resolutions, "apply_async_with_future") as publish,
        patch("sentry.tasks.clear_expired_resolutions.logger") as logger,
        pytest.raises(RetryTaskError),
    ):
        clear_expired_resolutions(successor.id)
    publish.assert_not_called()
    logger.exception.assert_called_once()
    assert logger.exception.call_args.kwargs["extra"]["phase"] == "successor"
    assert logger.exception.call_args.kwargs["extra"]["error"] == "other"
    assert logger.exception.call_args.kwargs["extra"]["project_id"] == default_group.project_id
    assert logger.exception.call_args.kwargs["extra"]["anchor_id"] == anchor.id
    resolution.refresh_from_db()
    assert resolution.status == GroupResolution.Status.pending
