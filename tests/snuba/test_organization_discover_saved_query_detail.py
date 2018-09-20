from __future__ import absolute_import

import six
from sentry.testutils import APITestCase
from django.core.urlresolvers import reverse
from sentry.testutils import SnubaTestCase

from sentry.models import DiscoverSavedQuery


class OrganizationDiscoverSavedQueryDetailTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationDiscoverSavedQueryDetailTest, self).setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project_ids = [
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

        model.add_projects(self.project_ids)

        self.query_id = model.id

    def test_get(self):
        with self.feature('organizations:discover'):
            url = reverse(
                'sentry-api-0-organization-discover-saved-query-detail',
                args=[
                    self.org.slug,
                    self.query_id])
            response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(self.query_id)
        assert response.data['projects'] == self.project_ids
        assert response.data['fields'] == ['test']
        assert response.data['conditions'] == []
        assert response.data['limit'] == 10
