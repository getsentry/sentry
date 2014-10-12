from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse

from sentry.models import Group, GroupBookmark, GroupStatus
from sentry.testutils import APITestCase


class GroupDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-details', kwargs={
            'group_id': group.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(group.id)

    def test_resolve(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-details', kwargs={
            'group_id': group.id,
        })
        response = self.client.post(url, data={
            'status': 'resolved',
        }, format='json')
        assert response.status_code == 200, response.content

        group = Group.objects.get(
            id=group.id,
            project=group.project.id,
        )
        assert group.status == GroupStatus.RESOLVED

    def test_bookmark(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-details', kwargs={
            'group_id': group.id
        })
        response = self.client.post(url, data={
            'isBookmarked': '1',
        }, format='json')

        assert response.status_code == 200, response.content

        # ensure we've created the bookmark
        assert GroupBookmark.objects.filter(
            group=group, user=self.user).exists()

    def test_delete(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-details', kwargs={
            'group_id': group.id
        })
        response = self.client.delete(url, format='json')

        assert response.status_code == 202, response.content

        group = Group.objects.filter(id=group.id).exists()
        assert not group
