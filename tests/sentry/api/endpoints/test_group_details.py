from __future__ import absolute_import, print_function

import mock
import six

from datetime import timedelta
from django.utils import timezone

from sentry import tagstore
from sentry.models import (
    Activity, Environment, Group, GroupHash, GroupAssignee, GroupBookmark,
    GroupResolution, GroupSeen, GroupSnooze, GroupSubscription, GroupStatus,
    GroupTombstone, Release
)
from sentry.testutils import APITestCase


class GroupDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = u'/api/0/issues/{}/'.format(group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(group.id)
        assert response.data['firstRelease'] is None

    def test_with_first_release(self):
        self.login_as(user=self.user)

        group = self.create_group()
        release = Release.objects.create(
            organization_id=group.project.organization_id,
            version='1.0',
        )
        release.add_project(group.project)
        tagstore.create_group_tag_value(
            group_id=group.id,
            project_id=group.project_id,
            environment_id=self.environment.id,
            key='sentry:release',
            value=release.version,
        )

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(group.id)
        assert response.data['firstRelease']['version'] == release.version

    def test_pending_delete_pending_merge_excluded(self):
        group1 = self.create_group(
            status=GroupStatus.PENDING_DELETION,
        )
        group2 = self.create_group(
            status=GroupStatus.DELETION_IN_PROGRESS,
        )

        group3 = self.create_group(
            status=GroupStatus.PENDING_MERGE,
        )

        self.login_as(user=self.user)

        url = u'/api/0/issues/{}/'.format(group1.id)

        response = self.client.get(url, format='json')
        assert response.status_code == 404

        url = u'/api/0/issues/{}/'.format(group2.id)
        response = self.client.get(url, format='json')
        assert response.status_code == 404

        url = u'/api/0/issues/{}/'.format(group3.id)
        response = self.client.get(url, format='json')
        assert response.status_code == 404

    def test_environment(self):
        group = self.create_group()
        self.login_as(user=self.user)

        environment = Environment.get_or_create(group.project, 'production')

        url = u'/api/0/issues/{}/'.format(group.id)

        from sentry.api.endpoints.group_details import tsdb

        with mock.patch(
                'sentry.api.endpoints.group_details.tsdb.get_range',
                side_effect=tsdb.get_range) as get_range:
            response = self.client.get(url, {'environment': 'production'}, format='json')
            assert response.status_code == 200
            assert get_range.call_count == 2
            for args, kwargs in get_range.call_args_list:
                assert kwargs['environment_ids'] == [environment.id]

        response = self.client.get(url, {'environment': 'invalid'}, format='json')
        assert response.status_code == 404


class GroupUpdateTest(APITestCase):
    def test_resolve(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.put(
            url, data={
                'status': 'resolved',
            }, format='json'
        )
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

    def test_resolved_in_next_release(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project.flags.has_releases = True
        project.save()
        group = self.create_group(project=project)
        Release.get_or_create(
            version='abcd',
            project=project,
        )

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.put(
            url, data={
                'status': 'resolvedInNextRelease',
            }
        )
        assert response.status_code == 200, response.content

        group = Group.objects.get(
            id=group.id,
            project=group.project.id,
        )
        assert group.status == GroupStatus.RESOLVED

        assert GroupResolution.objects.filter(
            group=group,
        ).exists()

    def test_snooze_duration(self):
        group = self.create_group(checksum='a' * 32, status=GroupStatus.RESOLVED)

        self.login_as(user=self.user)

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.put(
            url, data={
                'status': 'ignored',
                'ignoreDuration': 30,
            }, format='json'
        )

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

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.put(
            url, data={
                'isBookmarked': '1',
            }, format='json'
        )

        assert response.status_code == 200, response.content

        # ensure we've created the bookmark
        assert GroupBookmark.objects.filter(group=group, user=self.user).exists()

        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=True,
        ).exists()

    def test_assign_username(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.put(
            url, data={
                'assignedTo': self.user.username,
            }, format='json'
        )

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(group=group, user=self.user).exists()

        assert Activity.objects.filter(
            group=group,
            user=self.user,
            type=Activity.ASSIGNED,
        ).count() == 1

        response = self.client.put(url, format='json')

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(group=group, user=self.user).exists()

        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=True,
        ).exists()

        response = self.client.put(
            url, data={
                'assignedTo': '',
            }, format='json'
        )

        assert response.status_code == 200, response.content

        assert not GroupAssignee.objects.filter(group=group, user=self.user).exists()

    def test_assign_id(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.put(
            url, data={
                'assignedTo': self.user.id,
            }, format='json'
        )

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(group=group, user=self.user).exists()

        assert Activity.objects.filter(
            group=group,
            user=self.user,
            type=Activity.ASSIGNED,
        ).count() == 1

        response = self.client.put(url, format='json')

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(group=group, user=self.user).exists()

        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=True,
        ).exists()

        response = self.client.put(
            url, data={
                'assignedTo': '',
            }, format='json'
        )

        assert response.status_code == 200, response.content

        assert not GroupAssignee.objects.filter(group=group, user=self.user).exists()

    def test_assign_team(self):
        self.login_as(user=self.user)

        group = self.create_group()
        team = self.create_team(organization=group.project.organization, members=[self.user])
        group.project.add_team(team)

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.put(
            url, data={
                'assignedTo': u'team:{}'.format(team.id),
            }, format='json'
        )

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(group=group, team=team).exists()

        assert Activity.objects.filter(
            group=group,
            type=Activity.ASSIGNED,
        ).count() == 1

        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=True,
        ).exists()

        response = self.client.put(
            url, data={
                'assignedTo': '',
            }, format='json'
        )

        assert response.status_code == 200, response.content

        assert Activity.objects.filter(
            group=group,
        ).count() == 2

        assert not GroupAssignee.objects.filter(group=group, team=team).exists()

    def test_assign_unavailable_team(self):
        self.login_as(user=self.user)

        group = self.create_group()
        team = self.create_team(organization=group.project.organization, members=[self.user])

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.put(
            url, data={
                'assignedTo': u'team:{}'.format(team.id),
            }, format='json'
        )

        assert response.status_code == 400, response.content

    def test_mark_seen(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.put(
            url, data={
                'hasSeen': '1',
            }, format='json'
        )

        assert response.status_code == 200, response.content

        assert GroupSeen.objects.filter(group=group, user=self.user).exists()

        response = self.client.put(
            url, data={
                'hasSeen': '0',
            }, format='json'
        )

        assert response.status_code == 200, response.content

        assert not GroupSeen.objects.filter(group=group, user=self.user).exists()

    def test_mark_seen_as_non_member(self):
        user = self.create_user('foo@example.com', is_superuser=True)
        self.login_as(user=user, superuser=True)

        group = self.create_group()

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.put(
            url, data={
                'hasSeen': '1',
            }, format='json'
        )

        assert response.status_code == 200, response.content

        assert not GroupSeen.objects.filter(group=group, user=self.user).exists()

    def test_subscription(self):
        self.login_as(user=self.user)
        group = self.create_group()

        url = u'/api/0/issues/{}/'.format(group.id)

        resp = self.client.put(
            url, data={
                'isSubscribed': 'true',
            }
        )
        assert resp.status_code == 200, resp.content
        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=True,
        ).exists()

        resp = self.client.put(
            url, data={
                'isSubscribed': 'false',
            }
        )
        assert resp.status_code == 200, resp.content
        assert GroupSubscription.objects.filter(
            user=self.user,
            group=group,
            is_active=False,
        ).exists()

    def test_discard(self):
        self.login_as(user=self.user)
        group = self.create_group()

        group_hash = GroupHash.objects.create(
            hash='x' * 32,
            project=group.project,
            group=group,
        )

        url = u'/api/0/issues/{}/'.format(group.id)

        with self.tasks():
            with self.feature('projects:discard-groups'):
                resp = self.client.put(
                    url, data={
                        'discard': True,
                    }
                )

        assert resp.status_code == 204
        assert not Group.objects.filter(
            id=group.id,
        ).exists()
        assert GroupHash.objects.filter(
            id=group_hash.id,
        ).exists()
        tombstone = GroupTombstone.objects.get(
            id=GroupHash.objects.get(id=group_hash.id).group_tombstone_id,
        )
        assert tombstone.message == group.message
        assert tombstone.culprit == group.culprit
        assert tombstone.project == group.project
        assert tombstone.data == group.data


class GroupDeleteTest(APITestCase):
    def test_delete(self):
        self.login_as(user=self.user)

        group = self.create_group()
        hash = 'x' * 32
        GroupHash.objects.create(
            project=group.project,
            hash=hash,
            group=group,
        )

        url = u'/api/0/issues/{}/'.format(group.id)

        response = self.client.delete(url, format='json')
        assert response.status_code == 202, response.content

        # Deletion was deferred, so it should still exist
        assert Group.objects.get(id=group.id).status == GroupStatus.PENDING_DELETION
        # BUT the hash should be gone
        assert not GroupHash.objects.filter(group_id=group.id).exists()

        Group.objects.filter(id=group.id).update(status=GroupStatus.UNRESOLVED)

        url = u'/api/0/issues/{}/'.format(group.id)

        with self.tasks():
            response = self.client.delete(url, format='json')

        assert response.status_code == 202, response.content

        # Now we killed everything with fire
        assert not Group.objects.filter(id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
