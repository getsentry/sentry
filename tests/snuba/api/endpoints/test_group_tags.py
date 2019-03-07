from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from sentry.testutils import APITestCase, SnubaTestCase


class GroupTagsTest(APITestCase, SnubaTestCase):
    def test_multi_env(self):
        now = timezone.now()
        min_ago = now - timedelta(minutes=1)
        env = self.create_environment(project=self.project, name='prod')
        env2 = self.create_environment(project=self.project, name='staging')
        self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'timestamp': min_ago.isoformat()[:19],
                'environment': env.name,
                'tags': {'foo': 'bar'},
            },
            project_id=self.project.id
        )
        event2 = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'timestamp': min_ago.isoformat()[:19],
                'environment': env2.name,
                'tags': {'biz': 'baz'},
            },
            project_id=self.project.id
        )

        self.login_as(user=self.user)
        url = u'/api/0/issues/{}/tags/?enable_snuba=1'.format(event2.group.id)
        response = self.client.get(
            '%s&environment=%s&environment=%s' % (url, env.name, env2.name),
            format='json'
        )
        assert response.status_code == 200
        assert set([tag['key'] for tag in response.data
                    ]) >= set(['biz', 'environment', 'foo'])
