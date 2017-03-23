from __future__ import absolute_import

from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class EventCommittersTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()

        event = self.create_event(
            event_id='a',
            group=group,
            datetime=datetime(2016, 8, 13, 3, 8, 25),
        )

        url = reverse('sentry-api-0-event-file-committers', kwargs={
            'event_id': event.id,
            'project_slug': event.project.slug,
            'organization_slug': event.project.organization.slug,
        })

        response = self.client.get(url, format='json')
        assert response.status_code == 404, response.content
        assert response.data['detail'] == "No Commits found for Release"
        # TODO(maxbittker) test real responses once response shape is cemented
