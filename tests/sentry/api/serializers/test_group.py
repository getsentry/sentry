# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from mock import patch

from sentry.api.serializers import serialize
from sentry.models import (
    GroupResolution, GroupResolutionStatus, GroupSnooze, GroupStatus, Release
)
from sentry.testutils import TestCase


class GroupSerializerTest(TestCase):
    def test_is_muted_with_expired_snooze(self):
        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.MUTED,
        )
        GroupSnooze.objects.create(
            group=group,
            until=timezone.now() - timedelta(minutes=1),
        )

        result = serialize(group, user)
        assert result['status'] == 'unresolved'
        assert result['statusDetails'] == {}

    def test_is_muted_with_valid_snooze(self):
        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.MUTED,
        )
        snooze = GroupSnooze.objects.create(
            group=group,
            until=timezone.now() + timedelta(minutes=1),
        )

        result = serialize(group, user)
        assert result['status'] == 'muted'
        assert result['statusDetails'] == {'snoozeUntil': snooze.until}

    def test_resolved_in_next_release(self):
        release = Release.objects.create(
            project=self.project,
            version='a',
        )
        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.RESOLVED,
        )
        GroupResolution.objects.create(
            group=group,
            release=release,
        )

        result = serialize(group, user)
        assert result['status'] == 'resolved'
        assert result['statusDetails'] == {'inNextRelease': True}

    def test_resolved_in_next_release_expired_resolution(self):
        release = Release.objects.create(
            project=self.project,
            version='a',
        )
        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.RESOLVED,
        )
        GroupResolution.objects.create(
            group=group,
            release=release,
            status=GroupResolutionStatus.RESOLVED,
        )

        result = serialize(group, user)
        assert result['status'] == 'resolved'
        assert result['statusDetails'] == {}

    @patch('sentry.models.Group.is_over_resolve_age')
    def test_auto_resolved(self, mock_is_over_resolve_age):
        mock_is_over_resolve_age.return_value = True

        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.UNRESOLVED,
        )

        result = serialize(group, user)
        assert result['status'] == 'resolved'
        assert result['statusDetails'] == {'autoResolved': True}
