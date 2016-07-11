from __future__ import absolute_import

from sentry.app import tsdb
from sentry.testutils import APITestCase


class GroupTagKeyStatsTest(APITestCase):
    def test_release_stats(self):
        self.login_as(user=self.user)

        group1 = self.create_group()

        release1 = self.create_release(project=group1.project, verison='abc')
        release2 = self.create_release(project=group1.project, verison='def')

        url = '/api/0/issues/{}/tags/release/stats/'.format(group1.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        for point in response.data:
            assert point[1] == 0
        assert len(response.data) == 24

        tsdb.record_frequency_multi([
            (tsdb.models.frequent_releases_by_groups, {
                group1.id: {
                    release1.id: 3,
                    release2.id: 5,
                },
            })
        ])

        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24
