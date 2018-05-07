from __future__ import absolute_import

from django.core.urlresolvers import reverse

import six

from sentry.testutils import APITestCase


class EventIdLookupEndpointTest(APITestCase):
    def setUp(self):
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(checksum='a' * 32, project=self.project)
        self.event = self.create_event('b' * 32, group=self.group)
        self.login_as(user=self.user)

    def test_simple(self):
        url = reverse(
            'sentry-api-0-event-id-lookup', kwargs={
                'organization_slug': self.org.slug,
                'event_id': self.event.event_id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['organizationSlug'] == self.org.slug
        assert response.data['projectSlug'] == self.project.slug
        assert response.data['groupId'] == six.text_type(self.group.id)
        assert response.data['eventId'] == six.text_type(self.event.id)

    def test_missing_eventid(self):
        url = reverse(
            'sentry-api-0-event-id-lookup', kwargs={
                'organization_slug': self.org.slug,
                'event_id': 'c' * 32,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 404, response.content
