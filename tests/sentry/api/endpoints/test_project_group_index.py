from __future__ import absolute_import

from django.core.urlresolvers import reverse
from mock import patch

from sentry.models import Group, GroupBookmark, GroupStatus
from sentry.testutils import APITestCase
from sentry.testutils.helpers import parse_link_header


class GroupListTest(APITestCase):
    def test_simple(self):
        self.create_group(checksum='a' * 32)
        self.create_group(checksum='b' * 32)

        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-group-index', kwargs={
            'project_id': self.project.id})
        response = self.client.get(url + '?limit=1', format='json')
        assert response.status_code == 200
        # links come in {url: {...attrs}}, but we need {rel: {...attrs}}
        links = {
            d['rel']: d
            for d in parse_link_header(response['Link']).values()
        }

        assert links['previous']['results'] == 'false'
        assert links['next']['results'] == 'true'


class GroupUpdateTest(APITestCase):
    def test_global_status_update(self):
        group1 = self.create_group(checksum='a' * 32, status=GroupStatus.RESOLVED)
        group2 = self.create_group(checksum='b' * 32, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(checksum='c' * 32, status=GroupStatus.MUTED)
        group4 = self.create_group(
            project=self.create_project(slug='foo'),
            checksum='b' * 32, status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-group-index', kwargs={
            'project_id': self.project.id})
        response = self.client.put(url, data={
            'status': 'resolved',
        }, format='json')
        assert response.status_code == 204

        new_group1 = Group.objects.get(id=group1.id)
        assert new_group1.status == GroupStatus.RESOLVED
        assert new_group1.resolved_at is None

        new_group2 = Group.objects.get(id=group2.id)
        assert new_group2.status == GroupStatus.RESOLVED
        assert new_group2.resolved_at is not None

        new_group3 = Group.objects.get(id=group3.id)
        assert new_group3.status == GroupStatus.RESOLVED
        assert new_group3.resolved_at is not None

        new_group4 = Group.objects.get(id=group4.id)
        assert new_group4.status == GroupStatus.UNRESOLVED
        assert new_group4.resolved_at is None

    def test_selective_status_update(self):
        group1 = self.create_group(checksum='a' * 32, status=GroupStatus.RESOLVED)
        group2 = self.create_group(checksum='b' * 32, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(checksum='c' * 32, status=GroupStatus.MUTED)
        group4 = self.create_group(
            project=self.create_project(slug='foo'),
            checksum='b' * 32, status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)
        url = '{url}?id={group1.id}&id={group2.id}&group4={group4.id}'.format(
            url=reverse('sentry-api-0-project-group-index', kwargs={
                'project_id': self.project.id
            }),
            group1=group1,
            group2=group2,
            group4=group4,
        )
        response = self.client.put(url, data={
            'status': 'resolved',
        }, format='json')
        assert response.status_code == 200

        new_group1 = Group.objects.get(id=group1.id)
        assert new_group1.resolved_at is None

        new_group2 = Group.objects.get(id=group2.id)
        assert new_group2.resolved_at is not None
        assert new_group2.status == GroupStatus.RESOLVED

        new_group3 = Group.objects.get(id=group3.id)
        assert new_group3.resolved_at is None
        assert new_group3.status == GroupStatus.MUTED

        new_group4 = Group.objects.get(id=group4.id)
        assert new_group4.resolved_at is None
        assert new_group4.status == GroupStatus.UNRESOLVED

    def test_set_bookmarked(self):
        group1 = self.create_group(checksum='a' * 32, status=GroupStatus.RESOLVED)
        group2 = self.create_group(checksum='b' * 32, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(checksum='c' * 32, status=GroupStatus.MUTED)
        group4 = self.create_group(
            project=self.create_project(slug='foo'),
            checksum='b' * 32, status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)
        url = '{url}?id={group1.id}&id={group2.id}&group4={group4.id}'.format(
            url=reverse('sentry-api-0-project-group-index', kwargs={
                'project_id': self.project.id
            }),
            group1=group1,
            group2=group2,
            group4=group4,
        )
        response = self.client.put(url, data={
            'isBookmarked': 'true',
        }, format='json')
        assert response.status_code == 200

        bookmark1 = GroupBookmark.objects.filter(group=group1, user=self.user)
        assert bookmark1.exists()

        bookmark2 = GroupBookmark.objects.filter(group=group2, user=self.user)
        assert bookmark2.exists()

        bookmark3 = GroupBookmark.objects.filter(group=group3, user=self.user)
        assert not bookmark3.exists()

        bookmark4 = GroupBookmark.objects.filter(group=group4, user=self.user)
        assert not bookmark4.exists()

    @patch('sentry.api.endpoints.project_group_index.merge_group')
    def test_merge(self, merge_group):
        group1 = self.create_group(checksum='a' * 32, times_seen=1)
        group2 = self.create_group(checksum='b' * 32, times_seen=50)
        group3 = self.create_group(checksum='c' * 32, times_seen=2)
        group4 = self.create_group(checksum='d' * 32)

        self.login_as(user=self.user)
        url = '{url}?id={group1.id}&id={group2.id}&id={group3.id}'.format(
            url=reverse('sentry-api-0-project-group-index', kwargs={
                'project_id': self.project.id
            }),
            group1=group1,
            group2=group2,
            group3=group3,
        )
        response = self.client.put(url, data={
            'merge': '1',
        }, format='json')
        assert response.status_code == 200

        assert len(merge_group.mock_calls) == 2
        merge_group.delay.assert_any_call(from_object_id=group1.id, to_object_id=group2.id)
        merge_group.delay.assert_any_call(from_object_id=group3.id, to_object_id=group2.id)


class GroupDeleteTest(APITestCase):
    def test_global_is_forbidden(self):
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-group-index', kwargs={
            'project_id': self.project.id})
        response = self.client.delete(url, data={
            'status': 'resolved',
        }, format='json')
        assert response.status_code == 400

    def test_delete_by_id(self):
        group1 = self.create_group(checksum='a' * 32, status=GroupStatus.RESOLVED)
        group2 = self.create_group(checksum='b' * 32, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(checksum='c' * 32, status=GroupStatus.MUTED)
        group4 = self.create_group(
            project=self.create_project(slug='foo'),
            checksum='b' * 32, status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)
        url = '{url}?id={group1.id}&id={group2.id}&group4={group4.id}'.format(
            url=reverse('sentry-api-0-project-group-index', kwargs={
                'project_id': self.project.id
            }),
            group1=group1,
            group2=group2,
            group4=group4,
        )

        with self.settings(CELERY_ALWAYS_EAGER=True):
            response = self.client.delete(url, format='json')
        assert response.status_code == 204

        new_group1 = Group.objects.filter(id=group1.id)
        assert not new_group1.exists()

        new_group2 = Group.objects.filter(id=group2.id)
        assert not new_group2.exists()

        new_group3 = Group.objects.filter(id=group3.id)
        assert new_group3.exists()

        new_group4 = Group.objects.filter(id=group4.id)
        assert new_group4.exists()
