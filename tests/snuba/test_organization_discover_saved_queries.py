from __future__ import absolute_import

from sentry.testutils import APITestCase
from django.core.urlresolvers import reverse
from sentry.testutils import SnubaTestCase

from sentry.models import DiscoverSavedQuery


class OrganizationDiscoverSavedQueriesTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationDiscoverSavedQueriesTest, self).setUp()

        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id
        ]
        query = {
            'fields': ['test'],
            'conditions': [],
            'limit': 10
        }

        model = DiscoverSavedQuery.objects.create(
            organization=self.org, name="Test query", query=query)

        model.add_projects(project_ids)

    def test_get(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-saved-queries', args=[self.org.slug])
            response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'Test query'
