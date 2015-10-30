from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.app import tsdb
from sentry.testutils import APITestCase


class ProjectStatsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project1 = self.create_project(name='foo')
        project2 = self.create_project(name='bar')

        tsdb.incr(tsdb.models.project_total_received, project1.id, count=3)
        tsdb.incr(tsdb.models.project_total_received, project2.id, count=5)

        url = reverse('sentry-api-0-project-stats', kwargs={
            'organization_slug': project1.organization.slug,
            'project_slug': project1.slug,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24
