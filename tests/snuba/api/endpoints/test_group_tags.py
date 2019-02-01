from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from sentry.testutils import APITestCase, SnubaTestCase


class GroupTagsTest(APITestCase, SnubaTestCase):
    def test_multi_env(self):
        now = timezone.now()
        min_ago = now - timedelta(minutes=1)
        group = self.create_group(first_seen=min_ago, last_seen=now)
        env = self.create_environment(project=group.project, name='prod')
        env2 = self.create_environment(project=group.project, name='staging')
        self.create_event(
            group=group,
            tags=[['foo', 'bar'], ['environment', env.name]],
            datetime=min_ago,
        )
        self.create_event(
            group=group,
            tags=[['biz', 'baz'], ['environment', env2.name]],
            datetime=min_ago,
        )

        self.login_as(user=self.user)
        url = u'/api/0/issues/{}/tags/?enable_snuba=1'.format(group.id)
        response = self.client.get(
            '%s&environment=%s&environment=%s' % (url, env.name, env2.name),
            format='json'
        )
        assert response.status_code == 200
        assert sorted([
            (tag['key'], tag['uniqueValues']) for tag in response.data
        ], key=lambda x: x[0]) == [
            ('biz', 1), ('environment', 2), ('foo', 1)
        ]
        assert len(response.data) == 3
