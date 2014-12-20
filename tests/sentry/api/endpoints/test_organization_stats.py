from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.app import tsdb
from sentry.testutils import APITestCase


class OrganizationStatsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')

        tsdb.incr(tsdb.models.organization_total_received, org.id, count=3)

        url = reverse('sentry-api-0-organization-stats', args=[org.slug])
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24
