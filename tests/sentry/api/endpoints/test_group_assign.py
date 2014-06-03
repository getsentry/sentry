from django.core.urlresolvers import reverse

from sentry.models import Activity, GroupAssignee
from sentry.testutils import APITestCase


class GroupAssignTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-assign', kwargs={
            'group_id': group.id
        })

        response = self.client.post(url, format='json')

        assert response.status_code == 400, response.content

        response = self.client.post(url, data={'user': self.user.username}, format='json')

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(
            group=group, user=self.user
        ).exists()

        assert Activity.objects.filter(
            group=group, user=self.user, type=Activity.ASSIGNED,
        ).count() == 1

        response = self.client.post(url, data={'user': self.user.username}, format='json')

        assert response.status_code == 200, response.content

        assert Activity.objects.filter(
            group=group, user=self.user, type=Activity.ASSIGNED,
        ).count() == 1
