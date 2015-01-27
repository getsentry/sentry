from django.core.urlresolvers import reverse

from sentry.models import GroupSeen
from sentry.testutils import APITestCase


class GroupMarkSeenTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-markseen', kwargs={
            'group_id': group.id,
        })
        response = self.client.post(url, format='json')

        assert response.status_code == 201, response.content

        # ensure we've marked the group as seen
        assert GroupSeen.objects.filter(
            group=group, user=self.user).exists()
