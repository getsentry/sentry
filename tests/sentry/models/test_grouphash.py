from __future__ import absolute_import

from sentry.models import GroupHash
from sentry.testutils import TestCase


class GroupTest(TestCase):
    def test_fetch_and_record_last_processed_event_id(self):
        group = self.group

        grouphash = GroupHash.objects.create(
            project=group.project,
            group=group,
            hash='xyz',
        )

        GroupHash.record_last_processed_event_id(
            grouphash.id,
            'event',
        )

        assert GroupHash.fetch_last_processed_event_id(
            [grouphash.id, -1],
        ) == ['event', None]
