from django.core.urlresolvers import reverse
from mock import patch

from sentry.models import OrganizationMemberType, Team, TeamStatus
from sentry.testutils import APITestCase


class TeamDetailsTest(APITestCase):
    def test_simple(self):
        team = self.team  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-team-details', kwargs={'team_id': team.id})
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data['id'] == str(team.id)


class TeamUpdateTest(APITestCase):
    def test_simple(self):
        team = self.team  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-team-details', kwargs={'team_id': team.id})
        resp = self.client.put(url, data={
            'name': 'hello world',
            'slug': 'foobar',
        })
        assert resp.status_code == 200, resp.content
        team = Team.objects.get(id=team.id)
        assert team.name == 'hello world'
        assert team.slug == 'foobar'

    def test_invalid_slug(self):
        team = self.team  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-team-details', kwargs={'team_id': team.id})
        resp = self.client.put(url, data={
            'name': 'hello world',
            'slug': 'admin',
        })
        assert resp.status_code == 400, resp.content


class TeamDeleteTest(APITestCase):
    @patch('sentry.api.endpoints.team_details.delete_team')
    def test_as_admin(self, delete_team):
        team = self.create_team()
        project = self.create_project(team=team)  # NOQA

        user = self.create_user(email='foo@example.com', is_superuser=False)

        team.organization.member_set.create_or_update(
            user=user,
            defaults={
                'type': OrganizationMemberType.ADMIN,
            }
        )

        self.login_as(user)

        url = reverse('sentry-api-0-team-details', kwargs={'team_id': team.id})

        with self.settings(SENTRY_PROJECT=0):
            response = self.client.delete(url)

        team = Team.objects.get(id=team.id)

        assert team.status == TeamStatus.PENDING_DELETION

        assert response.status_code == 204
        delete_team.delay.assert_called_once_with(
            object_id=team.id,
            countdown=60 * 5,
        )

    def test_internal_project(self):
        team = self.create_team()
        project = self.create_project(team=team)

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-team-details', kwargs={'team_id': team.id})

        with self.settings(SENTRY_PROJECT=project.id):
            response = self.client.delete(url)

        assert response.status_code == 403

    def test_as_member(self):
        team = self.create_team(owner=self.user)
        project = self.create_project(team=team)  # NOQA

        user = self.create_user(email='foo@example.com', is_superuser=False)

        team.organization.member_set.create_or_update(
            user=user,
            defaults={
                'type': OrganizationMemberType.MEMBER,
            }
        )

        self.login_as(user=user)

        url = reverse('sentry-api-0-team-details', kwargs={'team_id': team.id})
        response = self.client.delete(url)

        assert response.status_code == 403
