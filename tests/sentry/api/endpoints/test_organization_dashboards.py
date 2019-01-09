from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Dashboard
from sentry.testutils import APITestCase


class OrganizationDashboardsTest(APITestCase):
    def setUp(self):
        super(OrganizationDashboardsTest, self).setUp()
        self.login_as(self.user)
        self.url = reverse(
            'sentry-api-0-organization-dashboard',
            kwargs={'organization_slug': self.organization.slug}
        )

    def test_get(self):
        Dashboard.objects.create(
            title='Dashboard 1',
            owner=self.user,
            organization=self.organization,
        )
        Dashboard.objects.create(
            title='Dashboard 2',
            owner=self.user,
            organization=self.organization,
            data={'stuff': 'stuff'}
        )

        response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        assert response.data[1]['id'] == '1'
        assert response.data[1]['organization'] == '2'
        assert response.data[1]['title'] == 'Dashboard 1'
        assert response.data[1]['owner'] == self.user.id
        assert response.data[1]['data'] == {}

        assert response.data[0]['id'] == '2'
        assert response.data[0]['organization'] == '2'
        assert response.data[0]['title'] == 'Dashboard 2'
        assert response.data[0]['owner'] == self.user.id
        assert response.data[0]['data'] == {'stuff': 'stuff'}

    def test_post(self):
        response = self.client.post(
            self.url,
            data={
                'title': 'Dashboard from Post',
                'data': {'data': 'data'},
                'owner': self.user.id,
                'organization': self.organization.id,
            }
        )
        assert response.status_code == 201
        dashboard = Dashboard.objects.get(
            organization=self.organization,
            title='Dashboard from Post'
        )
        assert dashboard.data == {'data': 'data'}
        assert dashboard.owner == self.user
