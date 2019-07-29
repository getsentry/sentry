from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone

from sentry.models import Group
from sentry.testutils import APITestCase, SnubaTestCase


class GroupEventsOldestTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(GroupEventsOldestTest, self).setUp()
        self.login_as(user=self.user)

        project = self.create_project()
        min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        two_min_ago = (timezone.now() - timedelta(minutes=2)).isoformat()[:19]

        self.event1 = self.store_event(
            data={
                'event_id': 'a' * 32,
                'environment': 'staging',
                'fingerprint': ['group_1'],
                'timestamp': two_min_ago
            },
            project_id=project.id,
        )

        self.event2 = self.store_event(
            data={
                'event_id': 'b' * 32,
                'environment': 'production',
                'fingerprint': ['group_1'],
                'timestamp': min_ago
            },
            project_id=project.id,
        )

        self.group = Group.objects.first()

    def test_snuba_no_environment(self):
        url = u'/api/0/issues/{}/events/oldest/'.format(self.group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200
        assert response.data['id'] == six.text_type(self.event1.event_id)

    def test_snuba_environment(self):
        url = u'/api/0/issues/{}/events/oldest/'.format(self.group.id)
        response = self.client.get(url, format='json', data={'environment': ['production']})

        assert response.status_code == 200
        assert response.data['id'] == six.text_type(self.event2.event_id)
