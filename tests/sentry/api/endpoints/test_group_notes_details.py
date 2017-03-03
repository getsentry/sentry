from __future__ import absolute_import

from exam import fixture

from sentry.models import Activity, Group
from sentry.testutils import APITestCase


class GroupNotesDetailsTest(APITestCase):
    @fixture
    def url(self):
        return '/api/0/issues/{}/comments/{}/'.format(
            self.group.id,
            self.activity.id,
        )

    def test_delete(self):
        self.login_as(user=self.user)

        url = self.url

        assert Group.objects.get(id=self.group.id).num_comments == 1

        response = self.client.delete(url, format='json')
        assert response.status_code == 204, response.status_code
        assert not Activity.objects.filter(id=self.activity.id).exists()

        assert Group.objects.get(id=self.group.id).num_comments == 0

    def test_put(self):
        self.login_as(user=self.user)

        url = self.url

        response = self.client.put(url, format='json')
        assert response.status_code == 400, response.content

        response = self.client.put(url, format='json', data={
            'text': 'hi haters',
        })
        assert response.status_code == 200, response.content

        activity = Activity.objects.get(id=response.data['id'])
        assert activity.user == self.user
        assert activity.group == self.group
        assert activity.data == {'text': 'hi haters'}
