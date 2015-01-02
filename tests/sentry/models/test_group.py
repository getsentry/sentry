from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import GroupStatus
from sentry.testutils import TestCase


class GroupTest(TestCase):
    def test_is_resolved(self):
        group = self.create_group(status=GroupStatus.RESOLVED)
        assert group.is_resolved()

        group.status = GroupStatus.MUTED
        assert not group.is_resolved()

        group.status = GroupStatus.UNRESOLVED
        assert not group.is_resolved()

        group.last_seen = timezone.now() - timedelta(hours=12)

        group.project.update_option('sentry:resolve_age', 24)

        assert not group.is_resolved()

        group.project.update_option('sentry:resolve_age', 1)

        assert group.is_resolved()
