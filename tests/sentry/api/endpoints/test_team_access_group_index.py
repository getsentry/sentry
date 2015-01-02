from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.constants import MEMBER_USER
from sentry.models import AccessGroup
from sentry.testutils import APITestCase


class TeamAccessGroupIndexTest(APITestCase):
    def test_simple(self):
        team = self.create_team()
        group_1 = AccessGroup.objects.create(team=team, name='bar')
        group_2 = AccessGroup.objects.create(team=team, name='foo')

        self.login_as(user=team.owner)

        url = reverse('sentry-api-0-team-access-group-index', kwargs={
            'team_id': team.id,
        })
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['id'] == str(group_1.id)
        assert response.data[1]['id'] == str(group_2.id)


class TeamAccessGroupCreateTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        team = self.create_team(slug='baz')
        url = reverse('sentry-api-0-team-access-group-index', kwargs={
            'team_id': team.id,
        })
        resp = self.client.post(url, data={
            'name': 'hello world',
            'type': 'user',
        })
        assert resp.status_code == 201, resp.content
        access_group = AccessGroup.objects.get(id=resp.data['id'])
        assert access_group.name == 'hello world'
        assert access_group.type == MEMBER_USER
        assert access_group.managed is False
        assert access_group.team == team
