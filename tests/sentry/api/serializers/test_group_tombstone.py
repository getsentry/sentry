# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.api.serializers import serialize
from sentry.models import (GroupHash, GroupTombstone)
from sentry.testutils import TestCase


class GroupTombstoneSerializerTest(TestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        org = self.create_organization(
            owner=self.user,
        )
        project = self.create_project(
            organization=org,
            name='CoolProj',
        )
        group = self.create_group(project=project)
        tombstone = GroupTombstone.objects.create(
            project_id=group.project_id,
            level=group.level,
            message=group.message,
            culprit=group.culprit,
            type=group.get_event_type(),
        )
        GroupHash.objects.create(
            project=group.project,
            hash='x' * 32,
            group=group,
            group_tombstone=tombstone
        )
        result = serialize(tombstone, self.user)

        assert result['message'] == group.message
        assert result['culprit'] == group.culprit
        assert result['project']['name'] == 'CoolProj'
