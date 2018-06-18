from __future__ import absolute_import

from datetime import datetime, timedelta
import time

from sentry.testutils import APITestCase
from django.core.urlresolvers import reverse
from sentry.testutils import SnubaTestCase


class OrganizationDiscoverTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationDiscoverTest, self).setUp()

        now = datetime.now()

        self.login_as(user=self.user)

        self.org = self.create_organization(owner=self.user, name='foo')

        self.project = self.create_project(
            name='bar',
            organization=self.org,
        )

        events = [{
            'event_id': 'x' * 32,
            'primary_hash': '1' * 32,
            'project_id': self.project.id,
            'message': 'message!',
            'platform': 'python',
            'datetime': now.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            'data': {
                'received': time.mktime(now.timetuple()),
            }
        }]

        self.snuba_insert(events)

    def test(self):

        url = reverse('sentry-api-0-organization-discover', args=[self.org.slug])
        response = self.client.post(url, {
            'projects': [self.project.id],
            'fields': ['message', 'platform'],
            'start': (datetime.now() - timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
            'end': datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
            'orderby': '-timestamp',
        })

        assert response.status_code == 200, response.content

        assert len(response.data['data']) == 1
        assert response.data['data'][0]['message'] == 'message!'
        assert response.data['data'][0]['platform'] == 'python'
