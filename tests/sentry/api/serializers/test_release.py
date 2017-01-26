# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.utils import timezone
from uuid import uuid4

from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseProject, TagValue
from sentry.testutils import TestCase


class ReleaseSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        project = self.create_project()
        project2 = self.create_project(organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version=uuid4().hex
        )
        release.add_project(project)
        release.add_project(project2)
        ReleaseProject.objects.filter(
            release=release,
            project=project
        ).update(new_groups=1)
        ReleaseProject.objects.filter(
            release=release,
            project=project2
        ).update(new_groups=1)
        TagValue.objects.create(
            project=project,
            key='sentry:release',
            value=release.version,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            times_seen=5,
        )

        result = serialize(release, user)
        assert result['version'] == release.version
        assert result['shortVersion'] == release.version
        # should be sum of all projects
        assert result['newGroups'] == 2
        assert result['firstEvent']
        assert result['lastEvent']

        result = serialize(release, user, project=project)
        # should be groups from one project
        assert result['newGroups'] == 1

        # Make sure a sha1 value gets truncated
        release.version = '0' * 40
        result = serialize(release, user)
        assert result['shortVersion'] == '0' * 12

    def test_no_tag_data(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id,
            version=uuid4().hex,
        )
        release.add_project(project)

        result = serialize(release, user)
        assert result['version'] == release.version
        assert not result['firstEvent']
        assert not result['lastEvent']
