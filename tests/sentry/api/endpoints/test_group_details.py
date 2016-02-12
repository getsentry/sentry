from __future__ import absolute_import, print_function

from datetime import timedelta
from django.utils import timezone

from sentry.models import (
    Activity, Group, GroupAssignee, GroupBookmark, GroupSeen, GroupSnooze,
    GroupStatus, GroupTagValue, Release
)
from sentry.testutils import APITestCase


class GroupDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = '/api/0/issues/{}/'.format(group.id)
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

        url = '/api/0/issues/{}/'.format(group.id)

        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(group.id)
        assert response.data['firstRelease']['version'] == release.version


class GroupUpdateTest(APITestCase):
    def test_resolve(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = '/api/0/issues/{}/'.format(group.id)

        response = self.client.put(url, data={
            'status': 'resolved',
        }, format='json')
        assert response.status_code == 200, response.content

        group = Group.objects.get(
            id=group.id,
            project=group.project.id,
        )
        assert group.status == GroupStatus.RESOLVED

    def test_snooze_duration(self):
        group = self.create_group(checksum='a' * 32, status=GroupStatus.RESOLVED)

        self.login_as(user=self.user)

        url = '/api/0/issues/{}/'.format(group.id)

        response = self.client.put(url, data={
            'status': 'muted',
            'snoozeDuration': 30,
        }, format='json')

        assert response.status_code == 200

        snooze = GroupSnooze.objects.get(group=group)

        assert snooze.until > timezone.now() + timedelta(minutes=29)
        assert snooze.until < timezone.now() + timedelta(minutes=31)

        assert response.data['statusDetails']['snoozeUntil'] == snooze.until

        group = Group.objects.get(id=group.id)
        assert group.get_status() == GroupStatus.MUTED

    def test_bookmark(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = '/api/0/issues/{}/'.format(group.id)

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

        url = '/api/0/issues/{}/'.format(group.id)

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

        url = '/api/0/issues/{}/'.format(group.id)

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

    def test_mark_seen_as_non_member(self):
        user = self.create_user('foo@example.com', is_superuser=True)
        self.login_as(user=user)

        group = self.create_group()

        url = '/api/0/issues/{}/'.format(group.id)

        response = self.client.put(url, data={
            'hasSeen': '1',
        }, format='json')

        assert response.status_code == 200, response.content

        assert not GroupSeen.objects.filter(
            group=group, user=self.user).exists()


class GroupDeleteTest(APITestCase):
    def test_delete(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = '/api/0/issues/{}/'.format(group.id)

        with self.tasks():
            response = self.client.delete(url, format='json')

        assert response.status_code == 202, response.content

        group = Group.objects.filter(id=group.id).exists()
        assert not group
