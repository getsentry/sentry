from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.db.deletion import BulkDeleteQuery
from sentry.models import Group, Project
from sentry.testutils import TestCase


class BulkDeleteQueryTest(TestCase):
    def test_project_restriction(self):
        project1 = self.create_project()
        group1_1 = self.create_group(project1)
        group1_2 = self.create_group(project1)
        project2 = self.create_project()
        group2_1 = self.create_group(project2)
        group2_2 = self.create_group(project2)
        BulkDeleteQuery(
            model=Group,
            project_id=project1.id,
        ).execute()
        assert Project.objects.filter(id=project1.id).exists()
        assert Project.objects.filter(id=project2.id).exists()
        assert Group.objects.filter(id=group2_1.id).exists()
        assert Group.objects.filter(id=group2_2.id).exists()
        assert not Group.objects.filter(id=group1_1.id).exists()
        assert not Group.objects.filter(id=group1_2.id).exists()

    def test_datetime_restriction(self):
        now = timezone.now()
        project1 = self.create_project()
        group1_1 = self.create_group(project1, last_seen=now - timedelta(days=1))
        group1_2 = self.create_group(project1, last_seen=now - timedelta(days=1))
        group1_3 = self.create_group(project1, last_seen=now)
        BulkDeleteQuery(
            model=Group,
            dtfield='last_seen',
            days=1,
        ).execute()
        assert not Group.objects.filter(id=group1_1.id).exists()
        assert not Group.objects.filter(id=group1_2.id).exists()
        assert Group.objects.filter(id=group1_3.id).exists()
