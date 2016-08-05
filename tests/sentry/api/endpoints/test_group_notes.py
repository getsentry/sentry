from __future__ import absolute_import

import six

from sentry.models import Activity
from sentry.testutils import APITestCase


class GroupNoteTest(APITestCase):
    def test_simple(self):
        group = self.group

        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=Activity.NOTE,
            user=self.user,
            data={'text': 'hello world'},
        )

        self.login_as(user=self.user)

        url = '/api/0/issues/{}/comments/'.format(group.id)
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(activity.id)


class GroupNoteCreateTest(APITestCase):
    def test_simple(self):
        group = self.group

        self.login_as(user=self.user)

        url = '/api/0/issues/{}/comments/'.format(group.id)

        response = self.client.post(url, format='json')
        assert response.status_code == 400

        response = self.client.post(url, format='json', data={
            'text': 'hello world',
        })
        assert response.status_code == 201, response.content

        activity = Activity.objects.get(id=response.data['id'])
        assert activity.user == self.user
        assert activity.group == group
        assert activity.data == {'text': 'hello world'}

        response = self.client.post(url, format='json', data={
            'text': 'hello world',
        })
        assert response.status_code == 400, response.content
