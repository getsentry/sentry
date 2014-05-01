from django.core.urlresolvers import reverse

from sentry.models import Group
from sentry.testutils import APITestCase


class GroupDeleteTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-delete', kwargs={
            'group_id': group.id
        })
        response = self.client.post(url, format='json')

        assert response.status_code == 200, response.content

        group = Group.objects.filter(id=group.id).exists()
        assert not group
