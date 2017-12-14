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
