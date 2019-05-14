from __future__ import absolute_import

from datetime import timedelta

import six
from django.utils import timezone

from sentry.testutils import (
    APITestCase,
    SnubaTestCase,
)


class GroupTagDetailsTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        key = 'foo'
        for _ in range(3):
            event = self.store_event(
                data={
                    'fingerprint': ['put-me-in-group1'],
                    'environment': 'production',
                    'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
                    'tags': {
                        key: 'oof',
                        'bar': 'rab',
                    },

                },
                project_id=self.project.id,
            )

        group = event.group

        self.login_as(user=self.user)

        url = u'/api/0/issues/{}/tags/{}/'.format(group.id, key)
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert response.data['key'] == six.text_type(key)
        assert response.data['totalValues'] == 3
