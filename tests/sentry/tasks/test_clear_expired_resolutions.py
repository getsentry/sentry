from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import Activity, Group, GroupResolution, GroupStatus, Release
from sentry.tasks.clear_expired_resolutions import clear_expired_resolutions
from sentry.testutils import TestCase


class ClearExpiredResolutionsTest(TestCase):
    def test_task_persistent_name(self):
        assert clear_expired_resolutions.name == "sentry.tasks.clear_expired_resolutions"

    def test_simple(self):
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
            type=Activity.SET_RESOLVED_IN_RELEASE,
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
            type=Activity.SET_RESOLVED_IN_RELEASE,
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
