from __future__ import absolute_import

from django.core.urlresolvers import reverse

import six

from sentry.testutils import APITestCase


class EventIdLookupEndpointTest(APITestCase):
    def test_simple(self):
        org = self.create_organization(owner=self.user)
        project = self.create_project(organization=org)
        group = self.create_group(checksum='a' * 32, project=project)
        event = self.create_event('b' * 32, group=group)
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-event-id-lookup', kwargs={
                'organization_slug': org.slug,
                'event_id': event.event_id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['organizationSlug'] == org.slug
        assert response.data['projectSlug'] == project.slug
        assert response.data['groupId'] == six.text_type(group.id)
        assert response.data['eventId'] == six.text_type(event.id)
