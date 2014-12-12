from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture
from mock import Mock, patch

from sentry.models import Team
from sentry.testutils import APITestCase


class OrganizationTeamsListTest(APITestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-0-organization-teams', args=[self.organization.slug])

    def test_simple(self):
        team = self.create_team()  # force creation
        self.login_as(user=self.user)
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(team.id)


class OrganizationTeamsCreateTest(APITestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-0-organization-teams', args=[self.organization.slug])

    @patch('sentry.api.endpoints.organization_teams.can_create_teams', Mock(return_value=False))
    def test_missing_permission(self):
        self.login_as(user=self.user)
        resp = self.client.post(self.path)
        assert resp.status_code == 403

    @patch('sentry.api.endpoints.organization_teams.can_create_teams', Mock(return_value=True))
    def test_missing_params(self):
        self.login_as(user=self.user)
        resp = self.client.post(self.path)
        assert resp.status_code == 400

    @patch('sentry.api.endpoints.organization_teams.can_create_teams', Mock(return_value=True))
    def test_valid_params(self):
        self.login_as(user=self.user)

        resp = self.client.post(self.path, data={
            'name': 'hello world',
            'slug': 'foobar',
        })
        assert resp.status_code == 201, resp.content
        team = Team.objects.get(id=resp.data['id'])
        assert team.name == 'hello world'
        assert team.slug == 'foobar'
        assert team.organization == self.organization

    @patch('sentry.api.endpoints.organization_teams.can_create_teams', Mock(return_value=True))
    def test_without_slug(self):
        self.login_as(user=self.user)

        resp = self.client.post(self.path, data={
            'name': 'hello world',
        })
        assert resp.status_code == 201, resp.content
        team = Team.objects.get(id=resp.data['id'])
        assert team.slug == 'hello-world'
