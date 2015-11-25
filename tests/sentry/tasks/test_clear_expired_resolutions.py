from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import (
    Activity, Group, GroupResolution, GroupResolutionStatus, GroupStatus,
    Release
)
from sentry.tasks.clear_expired_resolutions import clear_expired_resolutions
from sentry.testutils import TestCase


class ClearExpiredResolutionsTest(TestCase):
    def test_task_persistent_name(self):
        assert clear_expired_resolutions.name == 'sentry.tasks.clear_expired_resolutions'

    def test_simple(self):
        project = self.create_project()

        old_release = Release.objects.create(
            project=project,
            version='a',
        )

        group1 = self.create_group(
            project=project,
            status=GroupStatus.RESOLVED,
            active_at=timezone.now(),
        )
        resolution1 = GroupResolution.objects.create(
            group=group1,
            release=old_release,
        )
        activity1 = Activity.objects.create(
            group=group1,
            project=project,
            type=Activity.SET_RESOLVED_IN_RELEASE,
            ident=resolution1.id,
            data={'version': ''},
        )

        new_release = Release.objects.create(
            project=project,
            version='b',
            date_added=timezone.now() + timedelta(minutes=1),
        )

        group2 = self.create_group(
            status=GroupStatus.UNRESOLVED,
            active_at=timezone.now(),
        )
        resolution2 = GroupResolution.objects.create(
            group=group2,
            release=new_release,
        )
        activity2 = Activity.objects.create(
            group=group2,
            project=project,
            type=Activity.SET_RESOLVED_IN_RELEASE,
            ident=resolution2.id,
            data={'version': ''},
        )

        clear_expired_resolutions(new_release.id)

        assert Group.objects.get(
            id=group1.id,
        ).status == GroupStatus.RESOLVED

        assert Group.objects.get(
            id=group2.id,
        ).status == GroupStatus.UNRESOLVED

        # rows should not get removed as it breaks regression behavior
        resolution1 = GroupResolution.objects.get(id=resolution1.id)
        assert resolution1.status == GroupResolutionStatus.RESOLVED

        resolution2 = GroupResolution.objects.get(id=resolution2.id)
        assert resolution2.status == GroupResolutionStatus.PENDING

        activity1 = Activity.objects.get(id=activity1.id)
        assert activity1.data['version'] == new_release.version

        activity2 = Activity.objects.get(id=activity2.id)
        assert activity2.data['version'] == ''
