from __future__ import absolute_import

from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone
from mock import patch

from sentry.models import (
    EventMapping, Group, GroupBookmark, GroupSeen, GroupStatus
)
from sentry.testutils import APITestCase
from sentry.testutils.helpers import parse_link_header


class GroupListTest(APITestCase):
    def _parse_links(self, header):
        # links come in {url: {...attrs}}, but we need {rel: {...attrs}}
        links = {}
        for url, attrs in parse_link_header(header).iteritems():
            links[attrs['rel']] = attrs
            attrs['href'] = url
        return links

    def test_sort_by_date_with_tag(self):
        # XXX(dcramer): this tests a case where an ambiguous column name existed
        now = timezone.now()
        group1 = self.create_group(
            checksum='a' * 32,
            last_seen=now - timedelta(seconds=1),
        )
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-group-index', kwargs={
            'organization_slug': self.project.organization.slug,
            'project_slug': self.project.slug,
        })
        response = self.client.get(url + '?sort_by=date&query=is:unresolved', format='json')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(group1.id)

    def test_simple_pagination(self):
        now = timezone.now().replace(microsecond=0)
        group1 = self.create_group(
            checksum='a' * 32,
            last_seen=now - timedelta(seconds=1),
        )
        group2 = self.create_group(
            checksum='b' * 32,
            last_seen=now,
        )
        # group3 = self.create_group(
        #     checksum='c' * 32,
        #     last_seen=now - timedelta(seconds=1),
        # )

        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-group-index', kwargs={
            'organization_slug': self.project.organization.slug,
            'project_slug': self.project.slug,
        })
        response = self.client.get(url + '?sort_by=date&limit=1', format='json')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(group2.id)

        links = self._parse_links(response['Link'])

        assert links['previous']['results'] == 'false'
        assert links['next']['results'] == 'true'

        print(links['next']['cursor'])
        response = self.client.get(links['next']['href'], format='json')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(group1.id)

        links = self._parse_links(response['Link'])

        assert links['previous']['results'] == 'true'
        assert links['next']['results'] == 'false'

        # TODO(dcramer): not working correctly
        # print(links['previous']['cursor'])
        # response = self.client.get(links['previous']['href'], format='json')
        # assert response.status_code == 200
        # assert len(response.data) == 1
        # assert response.data[0]['id'] == str(group2.id)

        # links = self._parse_links(response['Link'])

        # assert links['previous']['results'] == 'false'
        # assert links['next']['results'] == 'true'

        # print(links['previous']['cursor'])
        # response = self.client.get(links['previous']['href'], format='json')
        # assert response.status_code == 200
        # assert len(response.data) == 0

        # group3 = self.create_group(
        #     checksum='c' * 32,
        #     last_seen=now + timedelta(seconds=1),
        # )

        # links = self._parse_links(response['Link'])

        # assert links['previous']['results'] == 'false'
        # assert links['next']['results'] == 'true'

        # print(links['previous']['cursor'])
        # response = self.client.get(links['previous']['href'], format='json')
        # assert response.status_code == 200
        # assert len(response.data) == 1
        # assert response.data[0]['id'] == str(group3.id)

    def test_stats_period(self):
        # TODO(dcramer): this test really only checks if validation happens
        # on statsPeriod
        now = timezone.now()
        self.create_group(
            checksum='a' * 32,
            last_seen=now - timedelta(seconds=1),
        )
        self.create_group(
            checksum='b' * 32,
            last_seen=now,
        )

        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-group-index', kwargs={
            'organization_slug': self.project.organization.slug,
            'project_slug': self.project.slug,
        })
        response = self.client.get(url + '?statsPeriod=24h', format='json')
        assert response.status_code == 200

        response = self.client.get(url + '?statsPeriod=14d', format='json')
        assert response.status_code == 200

        response = self.client.get(url + '?statsPeriod=', format='json')
        assert response.status_code == 200

        response = self.client.get(url + '?statsPeriod=48h', format='json')
        assert response.status_code == 400

    def test_auto_resolved(self):
        project = self.project
        project.update_option('sentry:resolve_age', 1)
        now = timezone.now()
        self.create_group(
            checksum='a' * 32,
            last_seen=now - timedelta(days=1),
        )
        group2 = self.create_group(
            checksum='b' * 32,
            last_seen=now,
        )

        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-group-index', kwargs={
            'organization_slug': self.project.organization.slug,
            'project_slug': self.project.slug,
        })
        response = self.client.get(url, format='json')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(group2.id)

    def test_lookup_by_event_id(self):
        project = self.project
        project.update_option('sentry:resolve_age', 1)
        group = self.create_group(checksum='a' * 32)
        self.create_group(checksum='b' * 32)
        EventMapping.objects.create(
            event_id='c' * 32,
            project=group.project,
            group=group,
        )

        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-group-index', kwargs={
            'organization_slug': self.project.organization.slug,
            'project_slug': self.project.slug,
        })
        response = self.client.get(url + '?query=' + ('c' * 32), format='json')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(group.id)

    def test_lookup_by_unknown_event_id(self):
        project = self.project
        project.update_option('sentry:resolve_age', 1)
        self.create_group(checksum='a' * 32)
        self.create_group(checksum='b' * 32)

        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-group-index', kwargs={
            'organization_slug': self.project.organization.slug,
            'project_slug': self.project.slug,
        })
        response = self.client.get(url + '?query=' + ('c' * 32), format='json')
        assert response.status_code == 200
        assert len(response.data) == 0


class GroupUpdateTest(APITestCase):
    def test_global_resolve(self):
        group1 = self.create_group(checksum='a' * 32, status=GroupStatus.RESOLVED)
        group2 = self.create_group(checksum='b' * 32, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(checksum='c' * 32, status=GroupStatus.MUTED)
        group4 = self.create_group(
            project=self.create_project(slug='foo'),
            checksum='b' * 32, status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-group-index', kwargs={
            'organization_slug': self.project.organization.slug,
            'project_slug': self.project.slug,
        })
        response = self.client.put(url + '?status=unresolved', data={
            'status': 'resolved',
        }, format='json')
        assert response.status_code == 200, response.data
        assert response.data == {
            'status': 'resolved',
        }

        # the previously resolved entry should not be included
        new_group1 = Group.objects.get(id=group1.id)
        assert new_group1.status == GroupStatus.RESOLVED
        assert new_group1.resolved_at is None

        new_group2 = Group.objects.get(id=group2.id)
        assert new_group2.status == GroupStatus.RESOLVED
        assert new_group2.resolved_at is not None

        # the muted entry should not be included
        new_group3 = Group.objects.get(id=group3.id)
        assert new_group3.status == GroupStatus.MUTED
        assert new_group3.resolved_at is None

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
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }),
            group1=group1,
            group2=group2,
            group4=group4,
        )
        response = self.client.put(url, data={
            'status': 'resolved',
        }, format='json')
        assert response.status_code == 200
        assert response.data == {
            'status': 'resolved',
        }

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

    def test_set_unresolved(self):
        group = self.create_group(checksum='a' * 32, status=GroupStatus.RESOLVED)

        self.login_as(user=self.user)

        url = '{url}?id={group.id}'.format(
            url=reverse('sentry-api-0-project-group-index', kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }),
            group=group,
        )
        response = self.client.put(url, data={
            'status': 'unresolved',
        }, format='json')
        assert response.status_code == 200
        assert response.data == {
            'status': 'unresolved',
        }

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

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
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }),
            group1=group1,
            group2=group2,
            group4=group4,
        )
        response = self.client.put(url, data={
            'isBookmarked': 'true',
        }, format='json')
        assert response.status_code == 200
        assert response.data == {
            'isBookmarked': True,
        }

        bookmark1 = GroupBookmark.objects.filter(group=group1, user=self.user)
        assert bookmark1.exists()

        bookmark2 = GroupBookmark.objects.filter(group=group2, user=self.user)
        assert bookmark2.exists()

        bookmark3 = GroupBookmark.objects.filter(group=group3, user=self.user)
        assert not bookmark3.exists()

        bookmark4 = GroupBookmark.objects.filter(group=group4, user=self.user)
        assert not bookmark4.exists()

    def test_set_public(self):
        group1 = self.create_group(checksum='a' * 32, is_public=False)
        group2 = self.create_group(checksum='b' * 32, is_public=False)

        self.login_as(user=self.user)
        url = '{url}?id={group1.id}&id={group2.id}'.format(
            url=reverse('sentry-api-0-project-group-index', kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }),
            group1=group1,
            group2=group2,
        )
        response = self.client.put(url, data={
            'isPublic': 'true',
        }, format='json')
        assert response.status_code == 200
        assert response.data == {
            'isPublic': True,
        }

        new_group1 = Group.objects.get(id=group1.id)
        assert new_group1.is_public

        new_group2 = Group.objects.get(id=group2.id)
        assert new_group2.is_public

    def test_set_private(self):
        group1 = self.create_group(checksum='a' * 32, is_public=True)
        group2 = self.create_group(checksum='b' * 32, is_public=True)

        self.login_as(user=self.user)
        url = '{url}?id={group1.id}&id={group2.id}'.format(
            url=reverse('sentry-api-0-project-group-index', kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }),
            group1=group1,
            group2=group2,
        )
        response = self.client.put(url, data={
            'isPublic': 'false',
        }, format='json')
        assert response.status_code == 200
        assert response.data == {
            'isPublic': False,
        }

        new_group1 = Group.objects.get(id=group1.id)
        assert not new_group1.is_public

        new_group2 = Group.objects.get(id=group2.id)
        assert not new_group2.is_public

    def test_set_has_seen(self):
        group1 = self.create_group(checksum='a' * 32, status=GroupStatus.RESOLVED)
        group2 = self.create_group(checksum='b' * 32, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(checksum='c' * 32, status=GroupStatus.MUTED)
        group4 = self.create_group(
            project=self.create_project(slug='foo'),
            checksum='b' * 32, status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)
        url = '{url}?id={group1.id}&id={group2.id}&group4={group4.id}'.format(
            url=reverse('sentry-api-0-project-group-index', kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }),
            group1=group1,
            group2=group2,
            group4=group4,
        )
        response = self.client.put(url, data={
            'hasSeen': 'true',
        }, format='json')
        assert response.status_code == 200
        assert response.data == {
            'hasSeen': True,
        }

        r1 = GroupSeen.objects.filter(group=group1, user=self.user)
        assert r1.exists()

        r2 = GroupSeen.objects.filter(group=group2, user=self.user)
        assert r2.exists()

        r3 = GroupSeen.objects.filter(group=group3, user=self.user)
        assert not r3.exists()

        r4 = GroupSeen.objects.filter(group=group4, user=self.user)
        assert not r4.exists()

    @patch('sentry.api.endpoints.project_group_index.merge_group')
    def test_merge(self, merge_group):
        group1 = self.create_group(checksum='a' * 32, times_seen=1)
        group2 = self.create_group(checksum='b' * 32, times_seen=50)
        group3 = self.create_group(checksum='c' * 32, times_seen=2)
        self.create_group(checksum='d' * 32)

        self.login_as(user=self.user)
        url = '{url}?id={group1.id}&id={group2.id}&id={group3.id}'.format(
            url=reverse('sentry-api-0-project-group-index', kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }),
            group1=group1,
            group2=group2,
            group3=group3,
        )
        response = self.client.put(url, data={
            'merge': '1',
        }, format='json')
        assert response.status_code == 200
        assert response.data['merge']['parent'] == str(group2.id)
        assert sorted(response.data['merge']['children']) == [
            str(group1.id),
            str(group3.id),
        ]

        assert len(merge_group.mock_calls) == 2
        merge_group.delay.assert_any_call(from_object_id=group1.id, to_object_id=group2.id)
        merge_group.delay.assert_any_call(from_object_id=group3.id, to_object_id=group2.id)


class GroupDeleteTest(APITestCase):
    def test_global_is_forbidden(self):
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-group-index', kwargs={
            'organization_slug': self.project.organization.slug,
            'project_slug': self.project.slug,
        })
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
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }),
            group1=group1,
            group2=group2,
            group4=group4,
        )

        with self.tasks():
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
