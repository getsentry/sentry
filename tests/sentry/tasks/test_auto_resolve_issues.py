from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from time import time

from sentry.models import Group, GroupStatus
from sentry.tasks.auto_resolve_issues import schedule_auto_resolution
from sentry.testutils import TestCase


class ScheduleAutoResolutionTest(TestCase):
    def test_task_persistent_name(self):
        assert schedule_auto_resolution.name == 'sentry.tasks.schedule_auto_resolution'

    def test_simple(self):
        project = self.create_project()
        project2 = self.create_project()
        project3 = self.create_project()
        project4 = self.create_project()

        current_ts = int(time()) - 1

        project.update_option('sentry:resolve_age', 1)
        project3.update_option('sentry:resolve_age', 1)
        project3.update_option('sentry:_last_auto_resolve', current_ts)
        project4.update_option('sentry:_last_auto_resolve', current_ts)

        group1 = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now() - timedelta(days=1),
        )

        group2 = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now(),
        )

        group3 = self.create_group(
            project=project3,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now() - timedelta(days=1),
        )

        with self.tasks():
            schedule_auto_resolution()

        assert Group.objects.get(
            id=group1.id,
        ).status == GroupStatus.RESOLVED

        assert Group.objects.get(
            id=group2.id,
        ).status == GroupStatus.UNRESOLVED

        assert Group.objects.get(
            id=group3.id,
        ).status == GroupStatus.UNRESOLVED

        assert project.get_option('sentry:_last_auto_resolve') > current_ts
        assert not project2.get_option('sentry:_last_auto_resolve')
        assert project3.get_option('sentry:_last_auto_resolve') == current_ts
        # this should get cleaned up since it had no resolve age set
        assert not project4.get_option('sentry:_last_auto_resolve')
