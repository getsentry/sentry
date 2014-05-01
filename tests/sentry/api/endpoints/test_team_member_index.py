from django.core.urlresolvers import reverse
from sentry.models import PendingTeamMember
from sentry.testutils import APITestCase


class TeamMemberIndexTest(APITestCase):
    def test_simple(self):
        user_1 = self.create_user('foo@localhost', username='foo')
        team = self.create_team(slug='baz', owner=user_1)
        PendingTeamMember.objects.create(email='bar@localhost', team=team)

        self.login_as(user=user_1)

        url = reverse('sentry-api-0-team-member-index', kwargs={
            'team_id': team.id,
        })
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['email'] == 'bar@localhost'
        assert response.data[1]['email'] == user_1.email
