from django.core.urlresolvers import reverse
from exam import fixture
from mock import Mock, patch

from sentry.constants import MEMBER_OWNER
from sentry.models import Team
from sentry.testutils import APITestCase


class TeamIndexTest(APITestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-0-team-index')

    def test_simple(self):
        team = self.create_team()  # force creation
        self.login_as(user=self.user)
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(team.id)


class TeamCreateTest(APITestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-0-team-index')

    @patch('sentry.api.endpoints.team_index.can_create_teams', Mock(return_value=False))
    def test_missing_permission(self):
        self.login_as(user=self.user)
        resp = self.client.post(self.path)
        assert resp.status_code == 403

    @patch('sentry.api.endpoints.team_index.can_create_teams', Mock(return_value=True))
    def test_missing_params(self):
        self.login_as(user=self.user)
        resp = self.client.post(self.path)
        assert resp.status_code == 400

    @patch('sentry.api.endpoints.team_index.can_create_teams', Mock(return_value=True))
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
        assert team.owner == self.user

        member_set = list(team.member_set.all())

        assert len(member_set) == 1
        member = member_set[0]
        assert member.user == team.owner
        assert member.type == MEMBER_OWNER

    @patch('sentry.api.endpoints.team_index.can_create_teams', Mock(return_value=True))
    def test_without_slug(self):
        self.login_as(user=self.user)

        resp = self.client.post(self.path, data={
            'name': 'hello world',
        })
        assert resp.status_code == 201, resp.content
        team = Team.objects.get(id=resp.data['id'])
        assert team.slug == 'hello-world'

    @patch('sentry.api.endpoints.team_index.can_create_teams', Mock(return_value=True))
    def test_superuser_can_set_owner(self):
        self.login_as(user=self.user)

        user2 = self.create_user(email='user2@example.com')

        resp = self.client.post(self.path, {
            'name': 'hello world',
            'slug': 'foobar',
            'owner': user2.username,
        })
        assert resp.status_code == 201, resp.content
        team = Team.objects.get(id=resp.data['id'])
        assert team.owner == user2

        member_set = list(team.member_set.all())

        assert len(member_set) == 1
        member = member_set[0]
        assert member.user == team.owner
        assert member.type == MEMBER_OWNER
