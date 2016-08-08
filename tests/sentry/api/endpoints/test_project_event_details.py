from __future__ import absolute_import

import six

from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ProjectEventDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()
        prev_event = self.create_event(
            event_id='a',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 24),
        )
        cur_event = self.create_event(
            event_id='b',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 25),
        )
        next_event = self.create_event(
            event_id='c',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 26),
        )

        url = reverse('sentry-api-0-project-event-details', kwargs={
            'event_id': cur_event.event_id,
            'project_slug': cur_event.project.slug,
            'organization_slug': cur_event.project.organization.slug,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(cur_event.id)
        assert response.data['nextEventID'] == six.text_type(next_event.event_id)
        assert response.data['previousEventID'] == six.text_type(prev_event.event_id)
        assert response.data['groupID'] == six.text_type(group.id)
