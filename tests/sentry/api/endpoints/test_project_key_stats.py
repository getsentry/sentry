from __future__ import absolute_import

from sentry import tsdb
from sentry.models import ProjectKey
from sentry.testutils import APITestCase


class ProjectKeyStatsTest(APITestCase):
    def setUp(self):
        self.project = self.create_project()
        self.key = ProjectKey.objects.create(
            project=self.project
        )
        self.login_as(user=self.user)
        self.path = '/api/0/projects/{}/{}/keys/{}/stats/'.format(
            self.project.organization.slug,
            self.project.slug,
            self.key.public_key,
        )

    def test_simple(self):
        response = self.client.get(self.path)
        assert response.status_code == 200

        tsdb.incr(tsdb.models.key_total_received, self.key.id, count=3)

        assert response.status_code == 200, response.content
        assert response.data[-1]['total'] == 3, response.data[-1]
        for point in response.data[:-1]:
            assert point['total'] == 0
        assert len(response.data) == 24
