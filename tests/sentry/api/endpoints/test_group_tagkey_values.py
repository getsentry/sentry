from __future__ import absolute_import

from datetime import timedelta

from django.utils import timezone

from sentry.testutils import (
    APITestCase,
    SnubaTestCase,
)


class GroupTagKeyValuesTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        key, value = 'foo', 'bar'

        project = self.create_project()
        event = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'environment': 'production',
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
                'tags': {
                    key: value,
                },

            },
            project_id=project.id,
        )
        group = event.group
        self.login_as(user=self.user)

        url = u'/api/0/issues/{}/tags/{}/values/'.format(group.id, key)

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]['value'] == value

    def test_user_tag(self):
        project = self.create_project()
        event = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'environment': 'production',
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
                'tags': {
                    'sentry:user': 'ident:1',
                },
                'user': {
                    'id': '1',
                    'email': 'foo@example.com',
                    'username': 'foo',
                    'ip_address': '127.0.0.1',
                }

            },
            project_id=project.id,
        )
        group = event.group
        self.login_as(user=self.user)

        url = u'/api/0/issues/{}/tags/user/values/'.format(group.id)

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]['email'] == 'foo@example.com'
        assert response.data[0]['value'] == 'id:1'
