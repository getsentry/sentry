from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.constants import STATUS_RESOLVED, STATUS_UNRESOLVED, STATUS_MUTED
from sentry.testutils import TestCase


class GroupTest(TestCase):
    def test_is_resolved(self):
        group = self.create_group(status=STATUS_UNRESOLVED)
        assert not group.is_resolved()

        group.status = STATUS_MUTED
        assert not group.is_resolved()

        group.status = STATUS_RESOLVED
        assert group.is_resolved()

        group.last_seen = timezone.now() - timedelta(hours=12)

        assert group.is_resolved()

        group.project.update_option('sentry:resolve_age', 24)

        assert group.is_resolved()

        group.project.update_option('sentry:resolve_age', 1)

        assert not group.is_resolved()
