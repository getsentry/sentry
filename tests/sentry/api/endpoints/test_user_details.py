from django.core.urlresolvers import reverse

from sentry.models import User
from sentry.testutils import APITestCase


class UserDetailsTest(APITestCase):
    def test_simple(self):
        user = self.create_user(email='a@example.com')
        team_1 = self.create_team(owner=user, name='a')
        project_1 = self.create_project(team=team_1)
        team_2 = self.create_team(owner=user, name='b')
        project_2 = self.create_project(team=team_2)

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-details', kwargs={
            'user_id': 'me',
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(user.id)
        assert len(response.data['teams']) == 2
        response.data['teams'].sort(key=lambda x: x['name'])
        assert response.data['teams'][0]['id'] == str(team_1.id)
        assert response.data['teams'][1]['id'] == str(team_2.id)
        assert len(response.data['teams'][0]['projects']) == 1
        assert response.data['teams'][0]['projects'][0]['id'] == str(project_1.id)
        assert len(response.data['teams'][1]['projects']) == 1
        assert response.data['teams'][1]['projects'][0]['id'] == str(project_2.id)


class UserUpdateTest(APITestCase):
    def test_simple(self):
        user = self.create_user(email='a@example.com')

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-details', kwargs={
            'user_id': 'me',
        })

        resp = self.client.put(url, data={
            'name': 'hello world',
            'email': 'b@example.com',
        })
        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == str(user.id)

        user = User.objects.get(id=user.id)
        assert user.first_name == 'hello world'
        assert user.email == 'b@example.com'
