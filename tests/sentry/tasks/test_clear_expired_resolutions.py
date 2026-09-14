from datetime import timedelta

from django.utils import timezone

from sentry.issues.action_log import SYSTEM_ACTOR, ActionSource, action_context_scope
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release
from sentry.tasks.clear_expired_resolutions import clear_expired_resolutions
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType


class ClearExpiredResolutionsTest(TestCase):
    def test_task_persistent_name(self) -> None:
        assert clear_expired_resolutions.name == "sentry.tasks.clear_expired_resolutions"

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

    def test_anchor_date_edit_finds_existing_successor(self) -> None:
        existing = self.create_release(version="existing", date_added=self.now - timedelta(days=4))
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

    def test_activity_preserves_resolution_metadata(self) -> None:
        with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
            activity = Activity.objects.create_group_activity(
                self.group,
                ActivityType.SET_RESOLVED_IN_RELEASE,
                ident=self.resolution.id,
                data={"version": "", "current_release_version": self.anchor.version},
            )
        next_release = self.create_release(version="next", date_added=self.now - timedelta(days=1))
        clear_expired_resolutions(next_release.id)
        activity.refresh_from_db()
        assert activity.data == {
            "version": next_release.version,
            "current_release_version": self.anchor.version,
        }
