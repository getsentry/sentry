from __future__ import absolute_import, print_function

from sentry.models import GroupHash, GroupTombstone
from sentry.testutils import APITestCase


class GroupTombstoneDetailsTest(APITestCase):

    def test_delete(self):
        self.login_as(user=self.user)

        group = self.create_group()
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
        assert GroupHash.objects.filter(group_tombstone=tombstone).exists()

        path = '/api/0/tombstone/{}/'.format(tombstone.id)
        response = self.client.delete(path)

        assert response.status_code == 202, response
        assert not GroupHash.objects.filter(group_tombstone=tombstone).exists()
