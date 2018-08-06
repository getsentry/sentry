from __future__ import absolute_import

import mock
from datetime import datetime

from django.utils import timezone

from sentry.models import GroupHash, GroupHashTombstone
from sentry.testutils import TestCase


class GroupHashTombstoneTest(TestCase):
    @mock.patch('django.utils.timezone.now')
    def test(self, mock_now):
        mock_now.return_value = datetime(2010, 1, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

        group = self.group

        hash1 = 'a' * 32
        GroupHash.objects.create(
            project=group.project,
            group=group,
            hash=hash1,
        )

        GroupHashTombstone.tombstone_groups(
            project_id=group.project_id,
            group_ids=[group.id],
        )

        assert GroupHashTombstone.objects.filter(hash=hash1, deleted_at=mock_now.return_value).exists()
        assert not GroupHash.objects.filter(group=group, hash=hash1).exists()

        mock_now.return_value = datetime(2011, 1, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

        # hash1 returns
        GroupHash.objects.create(
            project=group.project,
            group=group,
            hash=hash1,
        )

        hash2 = 'b' * 32
        GroupHash.objects.create(
            project=group.project,
            group=group,
            hash=hash2,
        )

        GroupHashTombstone.tombstone_groups(
            project_id=group.project_id,
            group_ids=[group.id],
        )

        assert GroupHashTombstone.objects.filter(hash=hash1, deleted_at=mock_now.return_value).exists()
        assert not GroupHash.objects.filter(group=group, hash=hash1).exists()
        assert GroupHashTombstone.objects.filter(hash=hash2, deleted_at=mock_now.return_value).exists()
        assert not GroupHash.objects.filter(group=group, hash=hash2).exists()
