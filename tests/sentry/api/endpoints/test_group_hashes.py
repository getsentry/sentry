from __future__ import absolute_import

from six.moves.urllib.parse import urlencode

from sentry.models import GroupHash
from sentry.testutils import APITestCase


class GroupHashesTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()
        GroupHash.objects.create(group=group, hash='a' * 32)
        GroupHash.objects.create(group=group, hash='b' * 32)

        url = u'/api/0/issues/{}/hashes/'.format(group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x['id'], response.data)) == sorted([
            'a' * 32,
            'b' * 32,
        ])

    def test_unmerge(self):
        self.login_as(user=self.user)

        group = self.create_group()

        hashes = [
            GroupHash.objects.create(
                project=group.project,
                group=group,
                hash=hash,
            ) for hash in ['a' * 32, 'b' * 32]
        ]

        url = '?'.join(
            [
                u'/api/0/issues/{}/hashes/'.format(group.id),
                urlencode({
                    'id': [h.hash for h in hashes],
                }, True),
            ]
        )

        response = self.client.delete(url, format='json')
        assert response.status_code == 202, response.content
