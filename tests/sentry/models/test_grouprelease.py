from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import GroupRelease, Release
from sentry.testutils import TestCase


class GetOrCreateTest(TestCase):
    def test_simple(self):
        project = self.create_project()
        group = self.create_group(project=project)
        release = Release.objects.create(version='abc', project=project)

        datetime = timezone.now()

        grouprelease = GroupRelease.get_or_create(
            group=group,
            release=release,
            environment='prod',
            datetime=datetime,
        )

        assert grouprelease.project_id == project.id
        assert grouprelease.group_id == group.id
        assert grouprelease.release_id == release.id
        assert grouprelease.environment == 'prod'
        assert grouprelease.first_seen == datetime
        assert grouprelease.last_seen == datetime

        datetime_new = timezone.now() + timedelta(days=1)

        grouprelease = GroupRelease.get_or_create(
            group=group,
            release=release,
            environment='prod',
            datetime=datetime_new,
        )

        assert grouprelease.first_seen == datetime
        assert grouprelease.last_seen == datetime_new

    def test_empty_env(self):
        project = self.create_project()
        group = self.create_group(project=project)
        release = Release.objects.create(version='abc', project=project)

        datetime = timezone.now()

        grouprelease = GroupRelease.get_or_create(
            group=group,
            release=release,
            environment=None,
            datetime=datetime,
        )

        assert grouprelease.environment == ''
