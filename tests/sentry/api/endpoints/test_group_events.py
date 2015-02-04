from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase


class GroupEventsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event_1 = self.create_event('a' * 32, group=group)
        event_2 = self.create_event('b' * 32, group=group)

        url = reverse('sentry-api-0-group-events', kwargs={
            'group_id': group.id
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x['id'], response.data)) == sorted([
            str(event_1.id),
            str(event_2.id),
        ])
