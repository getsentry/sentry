from __future__ import absolute_import

from sentry.testutils import APITestCase, SnubaTestCase
from django.core.urlresolvers import reverse

from sentry.models import DiscoverSavedQuery


class OrganizationDiscoverSavedQueriesTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationDiscoverSavedQueriesTest, self).setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id
        ]
        self.project_ids_without_access = [
            self.create_project().id
        ]
        query = {
            'fields': ['test'],
            'conditions': [],
            'limit': 10
        }

        model = DiscoverSavedQuery.objects.create(
            organization=self.org, created_by=self.user, name="Test query", query=query)

        model.set_projects(self.project_ids)

    def test_get(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-saved-queries', args=[self.org.slug])
            response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'Test query'
        assert response.data[0]['projects'] == self.project_ids
        assert response.data[0]['fields'] == ['test']
        assert response.data[0]['conditions'] == []
        assert response.data[0]['limit'] == 10

    def test_post(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-saved-queries', args=[self.org.slug])
            response = self.client.post(url, {
                'name': 'New query',
                'projects': self.project_ids,
                'fields': [],
                'range': '24h',
                'limit': 20,
                'conditions': [],
                'aggregations': [],
                'orderby': '-time',
            })

        assert response.status_code == 201, response.content
        assert response.data['name'] == 'New query'
        assert response.data['projects'] == self.project_ids
        assert response.data['range'] == '24h'
        assert not hasattr(response.data, 'start')
        assert not hasattr(response.data, 'end')

    def test_post_invalid_projects(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-saved-queries', args=[self.org.slug])
            response = self.client.post(url, {
                'name': 'New query',
                'projects': self.project_ids_without_access,
                'fields': [],
                'range': '24h',
                'limit': 20,
                'conditions': [],
                'aggregations': [],
                'orderby': '-time',
            })

        assert response.status_code == 403, response.content
