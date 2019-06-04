from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationEventDetailsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventDetailsEndpointTest, self).setUp()
        min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        two_min_ago = (timezone.now() - timedelta(minutes=2)).isoformat()[:19]
        self.login_as(user=self.user)
        self.project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'environment': 'staging',
                'timestamp': two_min_ago,
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                'event_id': 'b' * 32,
                'environment': 'staging',
                'timestamp': min_ago,
            },
            project_id=self.project.id,
        )

    def test_simple(self):
        url = reverse(
            'sentry-api-0-organization-event-details',
            kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
                'event_id': 'a' * 32,
            }
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == 'a' * 32
        assert response.data['previousEventID'] is None
        assert response.data['nextEventID'] == 'b' * 32

    def test_no_access(self):
        url = reverse(
            'sentry-api-0-organization-event-details',
            kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
                'event_id': 'a' * 32,
            }
        )

        response = self.client.get(url, format='json')

        assert response.status_code == 404, response.content

    def test_no_event(self):
        url = reverse(
            'sentry-api-0-organization-event-details',
            kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
                'event_id': 'c' * 32,
            }
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(url, format='json')

        assert response.status_code == 404, response.content
