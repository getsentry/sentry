from __future__ import absolute_import


from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.models import Group
from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationEventsTestBase(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsTestBase, self).setUp()
        self.min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        self.two_min_ago = (timezone.now() - timedelta(minutes=2)).isoformat()[:19]
        self.url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': self.organization.slug,
            }
        )


class OrganizationEventsV2EndpointTest(OrganizationEventsTestBase):
    def test_no_projects(self):
        self.login_as(user=self.user)
        with self.feature('organizations:events-v2'):
            response = self.client.get(self.url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_raw_data(self):
        self.login_as(user=self.user)
        project = self.create_project()
        project2 = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'environment': 'staging',
                'timestamp': self.two_min_ago,
                'user': {
                    'ip_address': '127.0.0.1',
                    'email': 'foo@example.com',
                },
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'b' * 32,
                'environment': 'staging',
                'timestamp': self.min_ago,
                'user': {
                    'ip_address': '127.0.0.1',
                    'email': 'foo@example.com',
                },
            },
            project_id=project2.id,
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['id', 'project.id', 'user.email', 'user.ip', 'time'],
                    'orderby': '-timestamp',
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['id'] == 'b' * 32
        assert response.data[0]['project.id'] == project2.id
        assert response.data[0]['user.email'] == 'foo@example.com'

    def test_project_name(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'environment': 'staging',
                'timestamp': self.min_ago,
            },
            project_id=project.id,
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['project.name', 'environment'],
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['project.name'] == project.slug
        assert 'project.id' not in response.data[0]
        assert response.data[0]['environment'] == 'staging'

    def test_groupby(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'environment': 'staging',
                'timestamp': self.min_ago,
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'b' * 32,
                'environment': 'staging',
                'timestamp': self.min_ago,
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'c' * 32,
                'environment': 'production',
                'timestamp': self.min_ago,
            },
            project_id=project.id,
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['project.id', 'environment'],
                    'groupby': ['project.id', 'environment'],
                    'orderby': 'environment',
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['project.id'] == project.id
        assert response.data[0]['environment'] == 'production'
        assert response.data[1]['project.id'] == project.id
        assert response.data[1]['environment'] == 'staging'

    def test_event_and_user_counts(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_1'],
                'user': {
                    'email': 'foo@example.com',
                },
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'b' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_2'],
                'user': {
                    'email': 'foo@example.com',
                },
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'c' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_2'],
                'user': {
                    'email': 'bar@example.com',
                },
            },
            project_id=project.id,
        )

        groups = Group.objects.all()

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'groupby': ['issue.id'],
                    'aggregation': ['uniq,id,event_count', 'uniq,sentry:user,user_count'],
                    'orderby': 'issue.id'
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['issue.id'] == groups[0].id
        assert response.data[0]['event_count'] == 1
        assert response.data[0]['user_count'] == 1
        assert response.data[1]['issue.id'] == groups[1].id
        assert response.data[1]['event_count'] == 2
        assert response.data[1]['user_count'] == 2
