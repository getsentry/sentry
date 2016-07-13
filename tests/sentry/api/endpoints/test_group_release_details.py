from __future__ import absolute_import

from sentry.app import tsdb
from sentry.models import Release
from sentry.testutils import APITestCase


class GroupReleaseDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group1 = self.create_group()

        release1 = Release.objects.create(project=group1.project, version='abc')
        release2 = Release.objects.create(project=group1.project, version='def')

        url = '/api/0/issues/{}/releases/abc/'.format(group1.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['version'] == release1.version
        for point in response.data['stats']:
            assert point[1] == 0
        assert len(response.data['stats']) == 24

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
        assert response.data['version'] == release1.version
        assert response.data['stats'][-1][1] == 3, response.data
        for point in response.data['stats'][:-1]:
            assert point[1] == 0
        assert len(response.data['stats']) == 24

    def test_latest(self):
        self.login_as(user=self.user)

        group1 = self.create_group()

        release1 = Release.objects.create(project=group1.project, version='abc')

        url = '/api/0/issues/{}/releases/:latest/'.format(group1.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['version'] == release1.version
