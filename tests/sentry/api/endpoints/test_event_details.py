from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class EventDetailsTest(APITestCase):
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

        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': cur_event.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(cur_event.id)
        assert response.data['nextEventID'] == str(next_event.id)
        assert response.data['previousEventID'] == str(prev_event.id)
        assert response.data['groupID'] == group.id
