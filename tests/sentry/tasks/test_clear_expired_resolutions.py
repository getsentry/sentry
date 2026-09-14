from datetime import timedelta

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release
from sentry.tasks.clear_expired_resolutions import clear_expired_resolutions
from sentry.testutils.cases import TestCase
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
        resolution = GroupResolution.objects.create(
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
        resolution = GroupResolution.objects.create(
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
