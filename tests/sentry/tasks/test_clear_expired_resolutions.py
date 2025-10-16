from datetime import timedelta

from django.utils import timezone

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

    @with_feature("organizations:resolve-in-future-release")
    def test_in_future_release_resolutions(self) -> None:
        """Test that in_future_release resolutions are properly cleared when a new release is created."""
        project = self.create_project()

        # Create group in release 1.0.0 resolved in future release 2.0.0
        old_release = self.create_release(
            project=project, version="package@1.0.0", date_added=timezone.now()
        )
        group = self.create_group(
            project=project, status=GroupStatus.RESOLVED, active_at=timezone.now()
        )
        resolution = GroupResolution.objects.create(
            group=group,
            release=old_release,
            type=GroupResolution.Type.in_future_release,
            future_release_version="package@2.0.0",
            status=GroupResolution.Status.pending,
        )
        activity = self.create_group_activity(
            group=group,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution.id,
            data={"version": ""},
        )

        # Create the 2.0.0 release that should trigger resolution clearing
        new_release = self.create_release(
            project=project,
            version="package@2.0.0",
            date_added=timezone.now() + timedelta(minutes=1),
        )

        clear_expired_resolutions(new_release.id)

        updated_resolution = GroupResolution.objects.get(id=resolution.id)
        assert updated_resolution.status == GroupResolution.Status.resolved
        assert updated_resolution.release == new_release
        assert updated_resolution.type == GroupResolution.Type.in_release

        updated_activity = Activity.objects.get(id=activity.id)
        assert updated_activity.data["version"] == new_release.version

    def test_in_future_release_without_feature_flag(self) -> None:
        """Test that in_future_release resolutions are NOT cleared when feature flag is disabled."""
        project = self.create_project()

        # Create group in release 1.0.0 resolved in future release 2.0.0
        old_release = self.create_release(
            project=project, version="package@1.0.0", date_added=timezone.now()
        )
        group = self.create_group(
            project=project, status=GroupStatus.RESOLVED, active_at=timezone.now()
        )
        resolution = GroupResolution.objects.create(
            group=group,
            release=old_release,
            type=GroupResolution.Type.in_future_release,
            future_release_version="package@2.0.0",
            status=GroupResolution.Status.pending,
        )

        # Create the 2.0.0 release that should trigger resolution clearing
        new_release = self.create_release(
            project=project,
            version="package@2.0.0",
            date_added=timezone.now() + timedelta(minutes=1),
        )

        clear_expired_resolutions(new_release.id)

        # Resolution should remain unchanged because feature flag is disabled
        updated_resolution = GroupResolution.objects.get(id=resolution.id)
        assert updated_resolution.status == GroupResolution.Status.pending
        assert updated_resolution.release == old_release
        assert updated_resolution.type == GroupResolution.Type.in_future_release

    @with_feature("organizations:resolve-in-future-release")
    def test_in_future_release_different_organization(self) -> None:
        """Test that in_future_release resolutions are NOT cleared for different organizations."""
        organization1 = self.create_organization()
        organization2 = self.create_organization()
        project1 = self.create_project(organization=organization1)
        project2 = self.create_project(organization=organization2)

        # Create group in project1 resolved in future release 2.0.0
        old_release = self.create_release(
            project=project1, version="package@1.0.0", date_added=timezone.now()
        )
        group = self.create_group(
            project=project1, status=GroupStatus.RESOLVED, active_at=timezone.now()
        )
        resolution = GroupResolution.objects.create(
            group=group,
            release=old_release,
            type=GroupResolution.Type.in_future_release,
            future_release_version="package@2.0.0",
            status=GroupResolution.Status.pending,
        )

        # Create the 2.0.0 release in project2 (different organization)
        new_release = self.create_release(
            project=project2,
            version="package@2.0.0",
            date_added=timezone.now() + timedelta(minutes=1),
        )

        clear_expired_resolutions(new_release.id)

        # Resolution should remain unchanged
        updated_resolution = GroupResolution.objects.get(id=resolution.id)
        assert updated_resolution.status == GroupResolution.Status.pending
        assert updated_resolution.release == old_release
        assert updated_resolution.type == GroupResolution.Type.in_future_release

    @with_feature("organizations:resolve-in-future-release")
    def test_in_future_release_multiple_groups(self) -> None:
        """Test that multiple groups with same future_release_version are all cleared."""
        project = self.create_project()

        old_release = self.create_release(project=project, version="package@1.0.0")

        # group 1: resolved in future release 2.0.0
        group1 = self.create_group(
            project=project, status=GroupStatus.RESOLVED, active_at=timezone.now()
        )
        resolution1 = GroupResolution.objects.create(
            group=group1,
            release=old_release,
            type=GroupResolution.Type.in_future_release,
            future_release_version="package@2.0.0",
            status=GroupResolution.Status.pending,
        )
        activity1 = self.create_group_activity(
            group=group1,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution1.id,
            data={"version": ""},
        )

        # group 2: resolved in future release 2.0.0
        group2 = self.create_group(
            project=project, status=GroupStatus.RESOLVED, active_at=timezone.now()
        )
        resolution2 = GroupResolution.objects.create(
            group=group2,
            release=old_release,
            type=GroupResolution.Type.in_future_release,
            future_release_version="package@2.0.0",
            status=GroupResolution.Status.pending,
        )
        activity2 = self.create_group_activity(
            group=group2,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution2.id,
            data={"version": ""},
        )

        # group 3: resolved in future release 3.0.0
        group3 = self.create_group(
            project=project, status=GroupStatus.RESOLVED, active_at=timezone.now()
        )
        resolution3 = GroupResolution.objects.create(
            group=group3,
            release=old_release,
            type=GroupResolution.Type.in_future_release,
            future_release_version="package@3.0.0",
            status=GroupResolution.Status.pending,
        )
        activity3 = self.create_group_activity(
            group=group3,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution3.id,
            data={"version": ""},
        )

        # Create the 2.0.0 release
        new_release = self.create_release(
            project=project,
            version="package@2.0.0",
            date_added=timezone.now() + timedelta(minutes=1),
        )

        clear_expired_resolutions(new_release.id)

        # Only groups 1 and 2 should be updated
        updated_resolution1 = GroupResolution.objects.get(id=resolution1.id)
        assert updated_resolution1.status == GroupResolution.Status.resolved
        assert updated_resolution1.release == new_release
        assert updated_resolution1.type == GroupResolution.Type.in_release
        updated_activity1 = Activity.objects.get(id=activity1.id)
        assert updated_activity1.data["version"] == new_release.version

        updated_resolution2 = GroupResolution.objects.get(id=resolution2.id)
        assert updated_resolution2.status == GroupResolution.Status.resolved
        assert updated_resolution2.release == new_release
        assert updated_resolution2.type == GroupResolution.Type.in_release
        updated_activity2 = Activity.objects.get(id=activity2.id)
        assert updated_activity2.data["version"] == new_release.version

        updated_resolution3 = GroupResolution.objects.get(id=resolution3.id)
        assert updated_resolution3.status == GroupResolution.Status.pending
        assert updated_resolution3.release == old_release
        assert updated_resolution3.type == GroupResolution.Type.in_future_release
        updated_activity3 = Activity.objects.get(id=activity3.id)
        assert updated_activity3.data["version"] == ""
