from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse

from sentry.models import (
    Activity, Group, GroupAssignee, GroupBookmark, GroupSeen, GroupStatus,
    GroupTagValue, Release
)
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
        assert response.data['firstRelease'] is None

    def test_with_first_release(self):
        self.login_as(user=self.user)

        group = self.create_group()
        release = Release.objects.create(
            project=group.project,
            version='1.0',
        )
        GroupTagValue.objects.create(
            group=group,
            project=group.project,
            key='sentry:release',
            value=release.version,
        )

        url = reverse('sentry-api-0-group-details', kwargs={
            'group_id': group.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(group.id)
        assert response.data['firstRelease']['version'] == release.version


class GroupUpdateTest(APITestCase):
    def test_resolve(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-details', kwargs={
            'group_id': group.id,
        })
        response = self.client.put(url, data={
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
        response = self.client.put(url, data={
            'isBookmarked': '1',
        }, format='json')

        assert response.status_code == 200, response.content

        # ensure we've created the bookmark
        assert GroupBookmark.objects.filter(
            group=group, user=self.user).exists()

    def test_assign(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-details', kwargs={
            'group_id': group.id
        })
        response = self.client.put(url, data={
            'assignedTo': self.user.username,
        }, format='json')

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(
            group=group, user=self.user
        ).exists()

        assert Activity.objects.filter(
            group=group, user=self.user, type=Activity.ASSIGNED,
        ).count() == 1

        response = self.client.put(url, format='json')

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(
            group=group, user=self.user
        ).exists()

        response = self.client.put(url, data={
            'assignedTo': '',
        }, format='json')

        assert response.status_code == 200, response.content

        assert not GroupAssignee.objects.filter(
            group=group, user=self.user
        ).exists()

    def test_mark_seen(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-details', kwargs={
            'group_id': group.id
        })
        response = self.client.put(url, data={
            'hasSeen': '1',
        }, format='json')

        assert response.status_code == 200, response.content

        assert GroupSeen.objects.filter(
            group=group, user=self.user).exists()

        response = self.client.put(url, data={
            'hasSeen': '0',
        }, format='json')

        assert response.status_code == 200, response.content

        assert not GroupSeen.objects.filter(
            group=group, user=self.user).exists()


class GroupDeleteTest(APITestCase):
    def test_delete(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = reverse('sentry-api-0-group-details', kwargs={
            'group_id': group.id
        })
        with self.tasks():
            response = self.client.delete(url, format='json')

        assert response.status_code == 202, response.content

        group = Group.objects.filter(id=group.id).exists()
        assert not group
