from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase


class GroupStatsTest(APITestCase):
    def test_simple(self):
        # TODO: ensure this test checks data
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-stats', kwargs={
            'group_id': group.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
