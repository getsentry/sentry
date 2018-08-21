from __future__ import absolute_import

from datetime import datetime, timedelta
import time
import uuid

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
            'event_id': uuid.uuid4().hex,
            'primary_hash': uuid.uuid4().hex,
            'project_id': self.project.id,
            'message': 'message!',
            'platform': 'python',
            'datetime': now.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            'data': {
                'received': time.mktime(now.timetuple()),
                'exception': {
                    'values': [
                        {
                            'type': 'ValidationError',
                            'value': 'Bad request',
                            'mechanism': {
                                'type': '1',
                                'value': '1',
                            },
                            'stacktrace': {
                                'frames': [
                                    {
                                        'function': '?',
                                        'filename': 'http://localhost:1337/error.js',
                                        'lineno': 29,
                                        'colno': 3,
                                        'in_app': True
                                    },
                                ]
                            },
                        }
                    ]
                },
            },

        }]

        self.snuba_insert(events)

    def test(self):
        url = reverse('sentry-api-0-organization-discover', args=[self.org.slug])
        response = self.client.post(url, {
            'projects': [self.project.id],
            'fields': ['message', 'platform'],
            'start': (datetime.now() - timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
            'end': (datetime.now() + timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
            'orderby': '-timestamp',
        })

        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 1
        assert response.data['data'][0]['message'] == 'message!'
        assert response.data['data'][0]['platform'] == 'python'

    def test_array_join(self):
        url = reverse('sentry-api-0-organization-discover', args=[self.org.slug])
        response = self.client.post(url, {
            'projects': [self.project.id],
            'fields': ['message', 'exception_stacks.type'],
            'start': (datetime.now() - timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
            'end': (datetime.now() + timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
            'orderby': '-timestamp',
        })
        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 1
        assert response.data['data'][0]['exception_stacks.type'] == 'ValidationError'
