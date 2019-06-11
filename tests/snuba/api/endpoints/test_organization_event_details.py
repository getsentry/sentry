from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.models import Group


class OrganizationEventDetailsTestBase(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventDetailsTestBase, self).setUp()
        min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        two_min_ago = (timezone.now() - timedelta(minutes=2)).isoformat()[:19]
        three_min_ago = (timezone.now() - timedelta(minutes=3)).isoformat()[:19]

        self.login_as(user=self.user)
        self.project = self.create_project()

        self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': three_min_ago,
                'fingerprint': ['group-1'],

            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                'event_id': 'b' * 32,
                'timestamp': two_min_ago,
                'fingerprint': ['group-1'],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                'event_id': 'c' * 32,
                'timestamp': min_ago,
                'fingerprint': ['group-2'],
            },
            project_id=self.project.id,
        )
        self.groups = Group.objects.all()


class OrganizationEventDetailsEndpointTest(OrganizationEventDetailsTestBase):
    def test_simple(self):
        url = reverse(
            'sentry-api-0-organization-event-details',
            kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
                'event_id': 'a' * 32,
            },
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == 'a' * 32
        assert response.data['previousEventID'] is None
        assert response.data['nextEventID'] == 'b' * 32
        assert response.data['projectSlug'] == self.project.slug

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
                'event_id': 'd' * 32,
            }
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(url, format='json')

        assert response.status_code == 404, response.content


class OrganizationEventDetailsLatestEndpointTest(OrganizationEventDetailsTestBase):
    def test_simple(self):
        url = reverse(
            'sentry-api-0-organization-event-details-latest',
            kwargs={
                'organization_slug': self.project.organization.slug,
            }
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == 'c' * 32
        assert response.data['previousEventID'] == 'b' * 32
        assert response.data['nextEventID'] is None
        assert response.data['projectSlug'] == self.project.slug

    def test_no_access(self):
        url = reverse(
            'sentry-api-0-organization-event-details-latest',
            kwargs={
                'organization_slug': self.project.organization.slug,
            }
        )

        response = self.client.get(url, format='json')

        assert response.status_code == 404, response.content

    def test_no_event(self):
        new_org = self.create_organization(owner=self.user)
        self.create_project(organization=new_org)
        url = reverse(
            'sentry-api-0-organization-event-details-latest',
            kwargs={
                'organization_slug': new_org.slug,
            }
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(url, format='json')

        assert response.status_code == 404, response.content

    def test_query_with_issue_id(self):
        url = reverse(
            'sentry-api-0-organization-event-details-latest',
            kwargs={
                'organization_slug': self.project.organization.slug,
            }
        )
        query = {'query': 'issue.id:{}'.format(self.groups[1].id)}

        with self.feature('organizations:events-v2'):
            response = self.client.get(url, query, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == 'c' * 32
        assert response.data['previousEventID'] is None
        assert response.data['nextEventID'] is None
        assert response.data['projectSlug'] == self.project.slug


class OrganizationEventDetailsOldestEndpointTest(OrganizationEventDetailsTestBase):
    def test_simple(self):
        url = reverse(
            'sentry-api-0-organization-event-details-oldest',
            kwargs={
                'organization_slug': self.project.organization.slug,
            }
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == 'a' * 32
        assert response.data['previousEventID'] is None
        assert response.data['nextEventID'] == 'b' * 32
        assert response.data['projectSlug'] == self.project.slug

    def test_no_access(self):
        url = reverse(
            'sentry-api-0-organization-event-details-oldest',
            kwargs={
                'organization_slug': self.project.organization.slug,
            }
        )

        response = self.client.get(url, format='json')

        assert response.status_code == 404, response.content

    def test_no_event(self):
        new_org = self.create_organization(owner=self.user)
        self.create_project(organization=new_org)
        url = reverse(
            'sentry-api-0-organization-event-details-oldest',
            kwargs={
                'organization_slug': new_org.slug,
            }
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(url, format='json')

        assert response.status_code == 404, response.content

    def test_query_with_issue_id(self):
        url = reverse(
            'sentry-api-0-organization-event-details-oldest',
            kwargs={
                'organization_slug': self.project.organization.slug,
            }
        )
        query = {'query': 'issue.id:{}'.format(self.groups[1].id)}

        with self.feature('organizations:events-v2'):
            response = self.client.get(url, query, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == 'c' * 32
        assert response.data['previousEventID'] is None
        assert response.data['nextEventID'] is None
        assert response.data['projectSlug'] == self.project.slug
