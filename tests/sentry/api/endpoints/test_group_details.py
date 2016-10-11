from __future__ import absolute_import, print_function

import six

from datetime import timedelta
from django.utils import timezone

from sentry.models import (
    Activity, Group, GroupHash, GroupAssignee, GroupBookmark, GroupSeen, GroupSnooze,
    GroupSubscription, GroupStatus, GroupTagValue, Release
)
from sentry.testutils import APITestCase


class GroupDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = '/api/0/issues/{}/'.format(group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(group.id)
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
        assert response.data['id'] == six.text_type(group.id)
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

        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=True,
        ).exists()

    def test_snooze_duration(self):
        group = self.create_group(checksum='a' * 32, status=GroupStatus.RESOLVED)

        self.login_as(user=self.user)

        url = '/api/0/issues/{}/'.format(group.id)

        response = self.client.put(url, data={
            'status': 'ignored',
            'ignoreDuration': 30,
        }, format='json')

        assert response.status_code == 200

        snooze = GroupSnooze.objects.get(group=group)

        assert snooze.until > timezone.now() + timedelta(minutes=29)
        assert snooze.until < timezone.now() + timedelta(minutes=31)

        assert response.data['statusDetails']['ignoreUntil'] == snooze.until

        group = Group.objects.get(id=group.id)
        assert group.get_status() == GroupStatus.IGNORED

        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=True,
        ).exists()

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

        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=True,
        ).exists()

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

        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=True,
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

    def test_subscription(self):
        self.login_as(user=self.user)
        group = self.create_group()

        url = '/api/0/issues/{}/'.format(group.id)

        resp = self.client.put(url, data={
            'isSubscribed': 'true',
        })
        assert resp.status_code == 200, resp.content
        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=True,
        ).exists()

        resp = self.client.put(url, data={
            'isSubscribed': 'false',
        })
        assert resp.status_code == 200, resp.content
        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=False,
        ).exists()


class GroupDeleteTest(APITestCase):
    def test_delete(self):
        self.login_as(user=self.user)

        group = self.create_group()
        GroupHash.objects.create(
            project=group.project,
            hash='x' * 32,
            group=group,
        )

        url = '/api/0/issues/{}/'.format(group.id)

        response = self.client.delete(url, format='json')

        assert response.status_code == 202, response.content

        # Deletion was deferred, so it should still exist
        assert Group.objects.get(id=group.id).status == GroupStatus.PENDING_DELETION
        # BUT the hash should be gone
        assert not GroupHash.objects.filter(group_id=group.id).exists()

        Group.objects.filter(id=group.id).update(status=GroupStatus.UNRESOLVED)

        url = '/api/0/issues/{}/'.format(group.id)

        with self.tasks():
            response = self.client.delete(url, format='json')

        assert response.status_code == 202, response.content

        # Now we killed everything with fire
        assert not Group.objects.filter(id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
