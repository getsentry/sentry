from __future__ import absolute_import

import six
from sentry.testutils import APITestCase
from django.core.urlresolvers import reverse
from sentry.testutils import SnubaTestCase

from sentry.models import DiscoverSavedQuery, DiscoverSavedQueryProject


class OrganizationDiscoverSavedQueryDetailTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationDiscoverSavedQueryDetailTest, self).setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.org_without_access = self.create_organization()
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
            organization=self.org, created_by=self.user, name="Test query", query=query)

        model.set_projects(self.project_ids)

        self.query_id = model.id

        invalid = DiscoverSavedQuery.objects.create(
            organization=self.org_without_access, name="Query without access", query=query
        )
        invalid.set_projects(self.project_ids)

        self.query_id_without_access = invalid.id

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

    def test_get_org_without_access(self):
        with self.feature('organizations:discover'):
            url = reverse(
                'sentry-api-0-organization-discover-saved-query-detail',
                args=[
                    self.org_without_access.slug,
                    self.query_id])
            response = self.client.get(url)

        assert response.status_code == 403, response.content

    def test_put(self):
        with self.feature('organizations:discover'):
            url = reverse(
                'sentry-api-0-organization-discover-saved-query-detail',
                args=[
                    self.org.slug,
                    self.query_id])

            response = self.client.put(url, {
                'name': 'New query',
                'projects': self.project_ids,
                'fields': [],
                'range': '24h',
                'limit': 20,
                'conditions': [],
                'aggregations': [],
                'orderby': '-time',
            })

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(self.query_id)
        assert response.data['projects'] == self.project_ids
        assert response.data['fields'] == []
        assert response.data['conditions'] == []
        assert response.data['limit'] == 20

    def test_put_query_without_access(self):
        with self.feature('organizations:discover'):
            url = reverse(
                'sentry-api-0-organization-discover-saved-query-detail',
                args=[
                    self.org.slug,
                    self.query_id_without_access])

            response = self.client.put(url, {
                'name': 'New query',
                'projects': self.project_ids,
                'range': '24h',
            })

            assert response.status_code == 404

    def test_put_org_without_access(self):
        with self.feature('organizations:discover'):
            url = reverse(
                'sentry-api-0-organization-discover-saved-query-detail',
                args=[
                    self.org_without_access.slug,
                    self.query_id])
            response = self.client.put(url, {
                'name': 'New query',
                'projects': self.project_ids,
                'range': '24h',
            })

        assert response.status_code == 403, response.content

    def test_delete(self):
        with self.feature('organizations:discover'):
            url = reverse(
                'sentry-api-0-organization-discover-saved-query-detail',
                args=[
                    self.org.slug,
                    self.query_id])

            response = self.client.delete(url)

            assert response.status_code == 204

            assert self.client.get(url).status_code == 404

    def test_delete_removes_projects(self):
        with self.feature('organizations:discover'):
            url = reverse(
                'sentry-api-0-organization-discover-saved-query-detail',
                args=[
                    self.org.slug,
                    self.query_id])

            self.client.delete(url)

        projects = list(
            DiscoverSavedQueryProject.objects.filter(
                discover_saved_query=self.query_id))

        assert projects == []

    def test_delete_query_without_access(self):
        with self.feature('organizations:discover'):
            url = reverse(
                'sentry-api-0-organization-discover-saved-query-detail',
                args=[
                    self.org.slug,
                    self.query_id_without_access])

            response = self.client.delete(url)

            assert response.status_code == 404

    def test_delete_org_without_access(self):
        with self.feature('organizations:discover'):
            url = reverse(
                'sentry-api-0-organization-discover-saved-query-detail',
                args=[
                    self.org_without_access.slug,
                    self.query_id])
            response = self.client.delete(url)

        assert response.status_code == 403, response.content
