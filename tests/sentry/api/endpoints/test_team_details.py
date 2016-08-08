from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from mock import patch

from sentry.models import Team, TeamStatus
from sentry.testutils import APITestCase


class TeamDetailsTest(APITestCase):
    def test_simple(self):
        team = self.team  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-team-details', kwargs={
            'organization_slug': team.organization.slug,
            'team_slug': team.slug,
        })
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data['id'] == six.text_type(team.id)


class TeamUpdateTest(APITestCase):
    def test_simple(self):
        team = self.team  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-team-details', kwargs={
            'organization_slug': team.organization.slug,
            'team_slug': team.slug,
        })
        resp = self.client.put(url, data={
            'name': 'hello world',
            'slug': 'foobar',
        })
        assert resp.status_code == 200, resp.content
        team = Team.objects.get(id=team.id)
        assert team.name == 'hello world'
        assert team.slug == 'foobar'


class TeamDeleteTest(APITestCase):
    @patch('sentry.api.endpoints.team_details.delete_team')
    def test_can_remove_as_team_admin(self, delete_team):
        org = self.create_organization()
        team = self.create_team(organization=org)
        project = self.create_project(team=team)  # NOQA

        user = self.create_user(email='foo@example.com', is_superuser=False)

        self.create_member(
            organization=org,
            user=user,
            role='admin',
            teams=[team],
        )

        self.login_as(user)

        url = reverse('sentry-api-0-team-details', kwargs={
            'organization_slug': team.organization.slug,
            'team_slug': team.slug,
        })

        with self.settings(SENTRY_PROJECT=0):
            response = self.client.delete(url)

        team = Team.objects.get(id=team.id)

        assert response.status_code == 204, response.data

        assert team.status == TeamStatus.PENDING_DELETION

        delete_team.delay.assert_called_once_with(
            object_id=team.id,
            countdown=3600,
        )

    def test_cannot_remove_as_member(self):
        org = self.create_organization(owner=self.user)
        team = self.create_team(organization=org)
        project = self.create_project(team=team)  # NOQA

        user = self.create_user(email='foo@example.com', is_superuser=False)

        team.organization.member_set.create_or_update(
            organization=org,
            user=user,
            values={
                'role': 'member',
            }
        )

        self.login_as(user=user)

        url = reverse('sentry-api-0-team-details', kwargs={
            'organization_slug': team.organization.slug,
            'team_slug': team.slug,
        })
        response = self.client.delete(url)

        assert response.status_code == 403
