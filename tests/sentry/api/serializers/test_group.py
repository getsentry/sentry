# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.models import GroupSnooze, GroupStatus
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
