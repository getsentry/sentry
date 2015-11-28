from __future__ import absolute_import

from sentry.app import tsdb
from sentry.testutils import APITestCase


class GroupStatsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group1 = self.create_group()
        group2 = self.create_group()

        url = '/api/0/issues/{}/stats/'.format(group1.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        for point in response.data:
            assert point[1] == 0
        assert len(response.data) == 24

        tsdb.incr(tsdb.models.group, group1.id, count=3)
        tsdb.incr(tsdb.models.group, group2.id, count=5)

        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24
