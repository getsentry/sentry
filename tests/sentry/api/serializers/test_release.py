# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.utils import timezone
from uuid import uuid4

from sentry.api.serializers import serialize
from sentry.models import Release, TagValue
from sentry.testutils import TestCase


class ReleaseSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            project=project,
            version=uuid4().hex,
            new_groups=1,
        )
        TagValue.objects.create(
            project=release.project,
            key='sentry:release',
            value=release.version,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            times_seen=5,
        )

        result = serialize(release, user)
        assert result['version'] == release.version
        assert result['shortVersion'] == release.version
        assert result['newGroups'] == 1
        assert result['firstEvent']
        assert result['lastEvent']

        # Make sure a sha1 value gets truncated
        release.version = '0' * 40
        result = serialize(release, user)
        assert result['shortVersion'] == '0' * 12

    def test_no_tag_data(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            project=project,
            version=uuid4().hex,
        )

        result = serialize(release, user)
        assert result['version'] == release.version
        assert not result['firstEvent']
        assert not result['lastEvent']
