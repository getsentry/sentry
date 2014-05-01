from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase


class GroupEventsLatestTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()
        self.create_event(
            event_id='a',
            group=group,
        )
        event_2 = self.create_event(
            event_id='b',
            group=group,
        )

        url = reverse('sentry-api-0-group-events-latest', kwargs={
            'group_id': group.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 302, response.content
        assert response['Location'] == 'http://testserver{0}'.format(
            reverse('sentry-api-0-event-details', kwargs={
                'event_id': event_2.id,
            })
        )
