from __future__ import absolute_import

import six

from sentry.testutils import APITestCase


class OrganizationProjectsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])

        path = '/api/0/organizations/{}/projects/'.format(org.slug)
        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(project.id)

    def test_with_stats(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        team = self.create_team(organization=org)
        self.create_project(teams=[team])

        path = '/api/0/organizations/{}/projects/'.format(org.slug)

        response = self.client.get('{}?statsPeriod=24h'.format(path), format='json')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['stats']

        response = self.client.get('{}?statsPeriod=14d'.format(path), format='json')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['stats']

        response = self.client.get('{}?statsPeriod='.format(path), format='json')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert 'stats' not in response.data[0]

        response = self.client.get('{}?statsPeriod=48h'.format(path), format='json')
        assert response.status_code == 400

    def test_search(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team], name='bar', slug='bar')

        path = '/api/0/organizations/{}/projects/?query=bar'.format(org.slug)
        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(project.id)

        path = '/api/0/organizations/{}/projects/?query=baz'.format(org.slug)
        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_search_by_ids(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        team = self.create_team(organization=org)
        project_bar = self.create_project(teams=[team], name='bar', slug='bar')
        project_foo = self.create_project(teams=[team], name='foo', slug='foo')
        self.create_project(teams=[team], name='baz', slug='baz')

        path = '/api/0/organizations/{}/projects/?query=id:{}'.format(org.slug, project_foo.id)
        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(project_foo.id)

        path = '/api/0/organizations/{}/projects/?query=id:{} id:{}'.format(org.slug, project_bar.id, project_foo.id)
        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
