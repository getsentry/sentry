from datetime import timedelta
from unittest.mock import Mock, patch

import pytest
from django.db import connections, router
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from taskbroker_client.retry import RetryTaskError

from sentry.issues.action_log import SYSTEM_ACTOR, ActionSource, action_context_scope
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release, ReleaseStatus
from sentry.tasks.clear_expired_resolutions import (
    RESOLUTION_BATCH_SECONDS,
    RESOLUTION_RETRY_TIMES,
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
        assert retry.initial_state().max_attempts == RESOLUTION_RETRY_TIMES

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

    def test_pages_continue_until_done_and_stop_when_flag_is_disabled(self) -> None:
        successor = self.create_release(version="next")
        other_group = self.create_group(project=self.project, status=GroupStatus.RESOLVED)
        other = self.create_group_resolution(
            group=other_group, release=self.anchor, type=GroupResolution.Type.in_next_release
        )
        with (
            patch("sentry.tasks.clear_expired_resolutions.RESOLUTION_BATCH_SIZE", 1),
            patch.object(clear_expired_resolutions, "delay") as delay,
        ):
            clear_expired_resolutions(successor.id)
            delay.assert_called_once_with(release_id=successor.id, after_id=self.resolution.id)
            self.resolution.refresh_from_db()
            other.refresh_from_db()
            assert self.resolution.release_id == successor.id
            assert other.status == GroupResolution.Status.pending

            with Feature({"organizations:release-resolution-finalized-order": False}):
                clear_expired_resolutions(successor.id, after_id=self.resolution.id)
            other.refresh_from_db()
            assert other.status == GroupResolution.Status.pending

            delay.reset_mock()
            clear_expired_resolutions(successor.id, after_id=self.resolution.id)
            other.refresh_from_db()
            assert other.release_id == successor.id
            delay.assert_called_once_with(release_id=successor.id, after_id=other.id)

            delay.reset_mock()
            clear_expired_resolutions(successor.id, after_id=other.id)
            delay.assert_not_called()

    def test_budget_cutoff_continues_from_the_last_examined_row(self) -> None:
        successor = self.create_release(version="next")
        other = self.create_group_resolution(
            group=self.create_group(project=self.project, status=GroupStatus.RESOLVED),
            release=self.anchor,
            type=GroupResolution.Type.in_next_release,
        )
        with (
            # The budget check before the second row sees the budget spent.
            patch(
                "sentry.tasks.clear_expired_resolutions.monotonic",
                side_effect=[0, RESOLUTION_BATCH_SECONDS],
            ),
            patch.object(clear_expired_resolutions, "delay") as delay,
        ):
            clear_expired_resolutions(successor.id)
        delay.assert_called_once_with(release_id=successor.id, after_id=self.resolution.id)
        self.resolution.refresh_from_db()
        other.refresh_from_db()
        assert self.resolution.release_id == successor.id
        assert other.status == GroupResolution.Status.pending

    def test_legacy_path_is_not_retried(self) -> None:
        successor = self.create_release(version="next")
        with Feature({"organizations:release-resolution-finalized-order": False}):
            with patch(
                "sentry.tasks.clear_expired_resolutions.current_task",
                return_value=Mock(attempt=1),
            ):
                clear_expired_resolutions(successor.id)
            self.resolution.refresh_from_db()
            assert self.resolution.status == GroupResolution.Status.pending

            clear_expired_resolutions(successor.id)
        self.resolution.refresh_from_db()
        assert self.resolution.release_id == successor.id


@django_db_all
def test_updates_only_the_latest_matching_activity(
    factories: Factories, default_group: Group
) -> None:
    now = timezone.now()
    project = default_group.project
    anchor = factories.create_release(
        project=project, version="anchor", date_added=now - timedelta(days=2)
    )
    successor = factories.create_release(
        project=project, version="next", date_added=now - timedelta(days=1)
    )
    resolution = factories.create_group_resolution(
        group=default_group, release=anchor, type=GroupResolution.Type.in_next_release
    )
    with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
        activities = [
            Activity.objects.create_group_activity(
                default_group,
                ActivityType.SET_RESOLVED_IN_RELEASE,
                ident=ident,
                data={"version": "", "preserve": True},
                datetime=created,
                send_notification=False,
            )
            for ident, created in [
                (resolution.id, now - timedelta(hours=1)),
                (resolution.id, now),
                # Ties on timestamp resolve to the newest row.
                (resolution.id, now),
                ("unrelated", now),
            ]
        ]

    with Feature({"organizations:release-resolution-finalized-order": True}):
        clear_expired_resolutions(successor.id)

    for activity in activities:
        activity.refresh_from_db()
    assert [a.data["version"] for a in activities] == ["", "", successor.version, ""]
    assert activities[2].data["preserve"] is True


@django_db_all
def test_page_with_distinct_successors_resolves_in_one_update(
    factories: Factories, default_group: Group
) -> None:
    now = timezone.now()
    project = default_group.project
    pairs = [
        (
            factories.create_release(
                project=project, version=f"anchor-{i}", date_added=now - timedelta(days=10 - 2 * i)
            ),
            factories.create_release(
                project=project, version=f"next-{i}", date_added=now - timedelta(days=9 - 2 * i)
            ),
        )
        for i in range(3)
    ]
    trigger = factories.create_release(project=project, version="trigger", date_added=now)
    resolutions = [
        factories.create_group_resolution(
            group=factories.create_group(project=project),
            release=anchor,
            type=GroupResolution.Type.in_next_release,
        )
        for anchor, _ in pairs
    ]
    with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
        activities = [
            Activity.objects.create_group_activity(
                resolution.group,
                ActivityType.SET_RESOLVED_IN_RELEASE,
                ident=resolution.id,
                data={"version": ""},
                send_notification=False,
            )
            for resolution in resolutions
        ]

    connection = connections[router.db_for_write(GroupResolution)]
    with (
        Feature({"organizations:release-resolution-finalized-order": True}),
        CaptureQueriesContext(connection) as queries,
    ):
        clear_expired_resolutions(trigger.id)

    updates = [q["sql"] for q in queries if q["sql"].startswith('UPDATE "sentry_groupresolution"')]
    assert len(updates) == 1
    for resolution, activity, (_, successor) in zip(resolutions, activities, pairs):
        resolution.refresh_from_db()
        activity.refresh_from_db()
        assert resolution.release_id == successor.id
        assert resolution.status == GroupResolution.Status.resolved
        assert activity.data == {"version": successor.version}


@django_db_all(transaction=True)
def test_slow_successor_retries_then_is_left_pending_without_blocking_later_pages(
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
        for _ in range(3)
    ]
    connection = connections[router.db_for_read(Release)]
    competing = connection.copy()
    get_next_release = Release.objects.get_next_release

    def slow_lookup(project, current_release, **kwargs):
        if current_release.id == slow_anchor.id:
            # Fails if the task still held resolution locks during lookups.
            with competing.cursor() as cursor:
                cursor.execute(
                    "SELECT id FROM sentry_groupresolution WHERE id = %s FOR UPDATE NOWAIT",
                    [slow.id],
                )
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_sleep(2)")
        return get_next_release(project, current_release, **kwargs)

    try:
        with (
            Feature({"organizations:release-resolution-finalized-order": True}),
            patch.object(Release.objects, "get_next_release", side_effect=slow_lookup),
            patch("sentry.tasks.clear_expired_resolutions.RESOLUTION_BATCH_SIZE", 2),
            patch("sentry.tasks.clear_expired_resolutions.monotonic", return_value=0),
            patch.object(clear_expired_resolutions, "delay") as delay,
            patch("sentry.tasks.clear_expired_resolutions.logger") as logger,
            patch("sentry.tasks.clear_expired_resolutions.metrics.incr") as incr,
        ):
            with (
                patch(
                    "sentry.tasks.clear_expired_resolutions.current_task",
                    return_value=Mock(attempt=0, retries_remaining=True),
                ),
                pytest.raises(RetryTaskError),
            ):
                clear_expired_resolutions(successor.id)
            # The healthy row in the same page commits before the page retries.
            healthy[0].refresh_from_db()
            assert healthy[0].release_id == successor.id
            delay.assert_not_called()

            # The broker can still report retries remaining on the last attempt.
            with patch(
                "sentry.tasks.clear_expired_resolutions.current_task",
                return_value=Mock(attempt=RESOLUTION_RETRY_TIMES - 1, retries_remaining=True),
            ):
                clear_expired_resolutions(successor.id)
            assert logger.warning.call_args.kwargs["extra"]["resolution_ids"] == [slow.id]
            assert logger.warning.call_args.kwargs["extra"]["retrying"] is False
            for outcome in ("retry", "exhausted"):
                incr.assert_any_call(
                    "releases.resolution_batch.unfinished",
                    amount=1,
                    tags={"outcome": outcome},
                    sample_rate=1.0,
                )
            delay.assert_called_once_with(release_id=successor.id, after_id=healthy[1].id)
            clear_expired_resolutions(successor.id, after_id=healthy[1].id)
            delay.assert_called_once()
        assert GroupResolution.objects.filter(
            id__in=[r.id for r in healthy], release=successor
        ).count() == len(healthy)
        slow.refresh_from_db()
        assert slow.status == GroupResolution.Status.pending
    finally:
        competing.close()

    # Replaying the logged arguments recovers the row once the lookup completes.
    with Feature({"organizations:release-resolution-finalized-order": True}):
        clear_expired_resolutions(successor.id, after_id=0)
    slow.refresh_from_db()
    assert slow.release_id == healthy_anchor.id


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
    other = factories.create_group_resolution(
        group=factories.create_group(project=project),
        release=anchor,
        type=GroupResolution.Type.in_next_release,
    )
    competing = connections[router.db_for_write(GroupResolution)].copy()
    try:
        competing.set_autocommit(False)
        with competing.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM sentry_groupresolution WHERE id = %s FOR UPDATE", [resolution.id]
            )
            with (
                Feature({"organizations:release-resolution-finalized-order": True}),
                patch("sentry.tasks.clear_expired_resolutions.logger") as logger,
                patch(
                    "sentry.tasks.clear_expired_resolutions.current_task",
                    return_value=Mock(attempt=0, retries_remaining=True),
                ),
                pytest.raises(RetryTaskError),
            ):
                clear_expired_resolutions(successor.id)
            assert logger.warning.call_args.kwargs["extra"]["resolution_ids"] == [
                resolution.id,
                other.id,
            ]
            other.refresh_from_db()
            assert other.status == GroupResolution.Status.pending
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
    other.refresh_from_db()
    assert resolution.release_id == manual.id
    assert other.release_id == successor.id


@django_db_all(transaction=True)
def test_rows_changed_before_the_lock_are_retried_from_current_state(
    factories: Factories, default_group: Group
) -> None:
    now = timezone.now()
    organization = default_group.project.organization
    projects = [factories.create_project(organization=organization) for _ in range(4)]
    anchors = [
        factories.create_release(
            project=p, version=f"anchor-{i}", date_added=now - timedelta(days=2)
        )
        for i, p in enumerate(projects)
    ]
    resolutions = [
        factories.create_group_resolution(
            group=factories.create_group(project=p),
            release=a,
            type=GroupResolution.Type.in_next_release,
        )
        for p, a in zip(projects, anchors)
    ]
    successor = factories.create_release(project=projects[0], version="next", date_added=now)
    for project in projects[1:]:
        successor.add_project(project)
    replacement = factories.create_release(
        project=projects[0], version="replacement", date_added=now - timedelta(days=1)
    )
    reprocessed_group = factories.create_group(project=projects[3])
    with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
        moved_activity = Activity.objects.create_group_activity(
            resolutions[3].group,
            ActivityType.SET_RESOLVED_IN_RELEASE,
            ident=resolutions[3].id,
            data={"version": ""},
            send_notification=False,
        )
    get_next_release = Release.objects.get_next_release

    def change_after_last_lookup(project, current_release, **kwargs):
        result = get_next_release(project, current_release, **kwargs)
        if current_release.id == anchors[-1].id:
            resolutions[0].update(release=replacement)
            anchors[1].update(date_released=now + timedelta(days=1))
            resolutions[2].update(
                status=GroupResolution.Status.resolved, type=GroupResolution.Type.in_release
            )
            # Reprocessing moves group-related rows to the replacement issue.
            for model in (GroupResolution, Activity):
                model.objects.filter(group_id=resolutions[3].group_id).update(
                    group_id=reprocessed_group.id
                )
        return result

    with (
        Feature({"organizations:release-resolution-finalized-order": True}),
        patch.object(Release.objects, "get_next_release", side_effect=change_after_last_lookup),
        patch("sentry.tasks.clear_expired_resolutions.logger") as logger,
        patch(
            "sentry.tasks.clear_expired_resolutions.current_task",
            return_value=Mock(attempt=0, retries_remaining=True),
        ),
        pytest.raises(RetryTaskError),
    ):
        clear_expired_resolutions(successor.id)
    assert logger.warning.call_args.kwargs["extra"]["resolution_ids"] == [
        resolutions[0].id,
        resolutions[1].id,
        resolutions[3].id,
    ]
    for resolution in resolutions:
        resolution.refresh_from_db()
    assert resolutions[0].release_id == replacement.id
    assert resolutions[0].status == GroupResolution.Status.pending
    assert resolutions[1].status == GroupResolution.Status.pending
    assert resolutions[2].release_id == anchors[2].id
    assert resolutions[3].status == GroupResolution.Status.pending

    # The retry evaluates the changed rows from their current state.
    with Feature({"organizations:release-resolution-finalized-order": True}):
        clear_expired_resolutions(successor.id)
    for resolution in resolutions:
        resolution.refresh_from_db()
    moved_activity.refresh_from_db()
    assert resolutions[0].release_id == successor.id
    assert resolutions[1].status == GroupResolution.Status.pending
    assert resolutions[3].release_id == successor.id
    assert moved_activity.group_id == reprocessed_group.id
    assert moved_activity.data == {"version": successor.version}
