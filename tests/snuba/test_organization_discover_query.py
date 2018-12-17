from __future__ import absolute_import

from datetime import datetime, timedelta

from sentry.testutils import APITestCase
from django.core.urlresolvers import reverse
from sentry.testutils import SnubaTestCase


class OrganizationDiscoverQueryTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationDiscoverQueryTest, self).setUp()

        one_second_ago = datetime.now() - timedelta(seconds=1)

        self.login_as(user=self.user)

        self.org = self.create_organization(owner=self.user, name='foo')

        self.project = self.create_project(
            name='bar',
            organization=self.org,
        )

        self.other_project = self.create_project(name='other')

        self.group = self.create_group(project=self.project, short_id=20)

        self.event = self.create_event(
            group=self.group,
            platform="python",
            datetime=one_second_ago,
            tags={'environment': 'production'},
            data={
                'message': 'message!',
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
                }
            },
        )

    def test(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'fields': ['message', 'platform'],
                'start': (datetime.now() - timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
                'end': (datetime.now()).strftime('%Y-%m-%dT%H:%M:%S'),
                'orderby': '-timestamp',
            })

        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 1
        assert response.data['data'][0]['message'] == 'message!'
        assert response.data['data'][0]['platform'] == 'python'

    def test_relative_dates(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'fields': ['message', 'platform'],
                'range': '1d',
                'orderby': '-timestamp',
            })

        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 1
        assert response.data['data'][0]['message'] == 'message!'
        assert response.data['data'][0]['platform'] == 'python'

    def test_invalid_date_request(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'fields': ['message', 'platform'],
                'range': '1d',
                'start': (datetime.now() - timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
                'end': (datetime.now()).strftime('%Y-%m-%dT%H:%M:%S'),
                'orderby': '-timestamp',
            })

        assert response.status_code == 400, response.content

    def test_invalid_range_value(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'fields': ['message', 'platform'],
                'range': '1x',
                'orderby': '-timestamp',
            })

        assert response.status_code == 400, response.content

    def test_invalid_aggregation_function(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'fields': ['message', 'platform'],
                'aggregations': [['test', 'test', 'test']],
                'range': '14d',
                'orderby': '-timestamp',
            })

        assert response.status_code == 400, response.content

    def test_boolean_condition(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'fields': ['message', 'platform', 'stack.in_app'],
                'conditions': [['stack.in_app', '=', True]],
                'start': (datetime.now() - timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
                'end': (datetime.now()).strftime('%Y-%m-%dT%H:%M:%S'),
                'orderby': '-timestamp',
            })

        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 1
        assert response.data['data'][0]['message'] == 'message!'
        assert response.data['data'][0]['platform'] == 'python'

    def test_array_join(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'fields': ['message', 'error.type'],
                'start': (datetime.now() - timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
                'end': (datetime.now() + timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
                'orderby': '-timestamp',
            })
        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 1
        assert response.data['data'][0]['error.type'] == 'ValidationError'

    def test_array_condition_equals(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'conditions': [['error.type', '=', 'ValidationError']],
                'fields': ['message'],
                'start': (datetime.now() - timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
                'end': (datetime.now()).strftime('%Y-%m-%dT%H:%M:%S'),
                'orderby': '-timestamp',
            })
        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 1

    def test_array_condition_not_equals(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'conditions': [['error.type', '!=', 'ValidationError']],
                'fields': ['message'],
                'start': (datetime.now() - timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%S'),
                'end': (datetime.now()).strftime('%Y-%m-%dT%H:%M:%S'),
                'orderby': '-timestamp',
            })

        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 0

    def test_select_project_name(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'fields': ['project.name'],
                'range': '14d',
                'orderby': '-timestamp',
            })
        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 1
        assert(response.data['data'][0]['project.name']) == 'bar'

    def test_groupby_project_name(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'aggregations': [['count()', '', 'count']],
                'fields': ['project.name'],
                'range': '14d',
                'orderby': '-count',
            })
        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 1
        assert(response.data['data'][0]['project.name']) == 'bar'
        assert(response.data['data'][0]['count']) == 1

    def test_uniq_project_name(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'aggregations': [['uniq', 'project.name', 'uniq_project_name']],
                'range': '14d',
                'orderby': '-uniq_project_name',
            })
        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 1
        assert(response.data['data'][0]['uniq_project_name']) == 1

    def test_meta_types(self):
        with self.feature('organizations:discover'):
            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.project.id],
                'fields': ['project.id', 'project.name'],
                'aggregations': [['count()', '', 'count']],
                'range': '14d',
                'orderby': '-count',
            })
        assert response.status_code == 200, response.content
        assert response.data['meta'] == [
            {'name': 'project.id', 'type': 'integer'},
            {'name': 'project.name', 'type': 'string'},
            {'name': 'count', 'type': 'integer'}
        ]

    def test_no_feature_access(self):
        url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
        response = self.client.post(url, {
            'projects': [self.project.id],
            'fields': ['message', 'platform'],
            'range': '14d',
            'orderby': '-timestamp',
        })

        assert response.status_code == 404, response.content

    def test_invalid_project(self):
        with self.feature('organizations:discover'):

            url = reverse('sentry-api-0-organization-discover-query', args=[self.org.slug])
            response = self.client.post(url, {
                'projects': [self.other_project.id],
                'fields': ['message', 'platform'],
                'range': '14d',
                'orderby': '-timestamp',
            })

        assert response.status_code == 403, response.content
