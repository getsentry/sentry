from django.core.urlresolvers import reverse
from sentry.constants import STATUS_RESOLVED
from sentry.models import Group
from sentry.testutils import APITestCase


class GroupResolveTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-resolve', kwargs={
            'group_id': group.id,
        })
        response = self.client.post(url, format='json')
        assert response.status_code == 200, response.content

        group = Group.objects.get(
            id=group.id,
            project=group.project.id,
        )
        assert group.status == STATUS_RESOLVED
