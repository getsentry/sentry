from __future__ import absolute_import

import json
import six
from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone
from exam import fixture

from sentry.models import ApiToken, Event, EventMapping, GroupStatus, Release
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from six.moves.urllib.parse import quote


class GroupListTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(GroupListTest, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)

    def _parse_links(self, header):
        # links come in {url: {...attrs}}, but we need {rel: {...attrs}}
        links = {}
        for url, attrs in six.iteritems(parse_link_header(header)):
            links[attrs['rel']] = attrs
            attrs['href'] = url
        return links

    @fixture
    def path(self):
        return reverse(
            'sentry-api-0-organization-group-index',
            args=[self.project.organization.slug]
        )

    def test_sort_by_date_with_tag(self):
        # XXX(dcramer): this tests a case where an ambiguous column name existed
        now = timezone.now()
        group1 = self.create_group(
            checksum='a' * 32,
            last_seen=now - timedelta(seconds=1),
        )
        self.create_event(
            group=group1,
            datetime=now - timedelta(seconds=1),
        )
        self.login_as(user=self.user)

        response = self.client.get(
            u'{}?sort_by=date&query=is:unresolved'.format(self.path),
            format='json',
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(group1.id)

    def test_invalid_query(self):
        now = timezone.now()
        self.create_group(
            checksum='a' * 32,
            last_seen=now - timedelta(seconds=1),
        )
        self.login_as(user=self.user)

        response = self.client.get(
            u'{}?sort_by=date&query=timesSeen:>1k'.format(self.path),
            format='json',
        )
        assert response.status_code == 400
        assert 'could not' in response.data['detail']

    def test_simple_pagination(self):
        now = timezone.now().replace(microsecond=0)
        group1 = self.create_group(
            project=self.project,
            last_seen=now - timedelta(seconds=2),
        )
        self.create_event(
            group=group1,
            datetime=now - timedelta(seconds=2),
        )
        group2 = self.create_group(
            project=self.project,
            last_seen=now - timedelta(seconds=1),
        )
        self.create_event(
            stacktrace=[['foo.py']],
            group=group2,
            datetime=now - timedelta(seconds=1),
        )
        self.login_as(user=self.user)
        response = self.client.get(
            u'{}?sort_by=date&limit=1'.format(self.path),
            format='json',
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(group2.id)

        links = self._parse_links(response['Link'])

        assert links['previous']['results'] == 'false'
        assert links['next']['results'] == 'true'

        response = self.client.get(links['next']['href'], format='json')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(group1.id)

        links = self._parse_links(response['Link'])

        assert links['previous']['results'] == 'true'
        assert links['next']['results'] == 'false'

    def test_stats_period(self):
        # TODO(dcramer): this test really only checks if validation happens
        # on groupStatsPeriod
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

        response = self.client.get(u'{}?groupStatsPeriod=24h'.format(self.path), format='json')
        assert response.status_code == 200

        response = self.client.get(u'{}?groupStatsPeriod=14d'.format(self.path), format='json')
        assert response.status_code == 200

        response = self.client.get(u'{}?groupStatsPeriod='.format(self.path), format='json')
        assert response.status_code == 200

        response = self.client.get(u'{}?groupStatsPeriod=48h'.format(self.path), format='json')
        assert response.status_code == 400

    def test_environment(self):
        self.create_environment(name='production', organization=self.project.organization)
        self.create_environment(name='staging', organization=self.project.organization)
        group = self.create_group(
            project=self.project,
        )
        group2 = self.create_group(
            project=self.project,
        )
        self.create_event(tags={'environment': 'production'}, group=group, datetime=self.min_ago)
        self.create_event(
            tags={
                'environment': 'staging'},
            group=group2,
            datetime=self.min_ago,
            stacktrace=[
                ['foo.py']])

        self.login_as(user=self.user)

        response = self.client.get(self.path + '?environment=production', format='json')
        assert response.status_code == 200
        assert len(response.data) == 1

        response = self.client.get(self.path + '?environment=garbage', format='json')
        assert response.status_code == 404

    def test_auto_resolved(self):
        project = self.project
        project.update_option('sentry:resolve_age', 1)
        now = timezone.now()
        group = self.create_group(
            checksum='a' * 32,
            last_seen=now - timedelta(days=1),
        )
        self.create_event(
            group=group,
            datetime=now - timedelta(days=1),
        )
        group2 = self.create_group(
            checksum='b' * 32,
            last_seen=now - timedelta(seconds=1),
        )
        self.create_event(
            group=group2,
            datetime=now - timedelta(seconds=1),
            stacktrace=[['foo.py']],
        )

        self.login_as(user=self.user)
        response = self.client.get(self.path, format='json')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(group2.id)

    def test_lookup_by_event_id(self):
        project = self.project
        project.update_option('sentry:resolve_age', 1)
        group = self.create_group(checksum='a' * 32)
        self.create_group(checksum='b' * 32)
        event_id = 'c' * 32
        Event.objects.create(project_id=self.project.id, event_id=event_id)
        EventMapping.objects.create(
            event_id=event_id,
            project=group.project,
            group=group,
        )

        self.login_as(user=self.user)

        response = self.client.get(u'{}?query={}'.format(self.path, 'c' * 32), format='json')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(group.id)

    def test_lookup_by_event_id_with_whitespace(self):
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
        response = self.client.get(
            u'{}?query=%20%20{}%20%20'.format(self.path, 'c' * 32), format='json'
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(group.id)

    def test_lookup_by_unknown_event_id(self):
        project = self.project
        project.update_option('sentry:resolve_age', 1)
        self.create_group(checksum='a' * 32)
        self.create_group(checksum='b' * 32)

        self.login_as(user=self.user)
        response = self.client.get(u'{}?query={}'.format(self.path, 'c' * 32), format='json')
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_lookup_by_short_id(self):
        group = self.group
        short_id = group.qualified_short_id

        self.login_as(user=self.user)
        response = self.client.get(
            u'{}?query={}&shortIdLookup=1'.format(
                self.path, short_id), format='json')
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_lookup_by_short_id_no_perms(self):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        project2 = self.create_project(organization=organization)
        team = self.create_team(organization=organization)
        project2.add_team(team)
        group = self.create_group(project=project)
        user = self.create_user()
        self.create_member(organization=organization, user=user, teams=[team])

        short_id = group.qualified_short_id

        self.login_as(user=user)

        path = reverse(
            'sentry-api-0-organization-group-index',
            args=[organization.slug]
        )
        response = self.client.get(
            u'{}?query={}&shortIdLookup=1'.format(
                path, short_id), format='json')
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_lookup_by_first_release(self):
        now = timezone.now()
        self.login_as(self.user)
        project = self.project
        project2 = self.create_project(name='baz', organization=project.organization)
        release = Release.objects.create(organization=project.organization, version='12345')
        release.add_project(project)
        release.add_project(project2)
        group = self.create_group(checksum='a' * 32, project=project, first_release=release)
        self.create_event(
            group=group,
            datetime=now - timedelta(seconds=1),
        )
        group2 = self.create_group(checksum='b' * 32, project=project2, first_release=release)
        self.create_event(
            group=group2,
            datetime=now - timedelta(seconds=1),
        )
        url = '%s?query=%s' % (self.path, quote('first-release:"%s"' % release.version))
        response = self.client.get(url, format='json')
        issues = json.loads(response.content)
        assert response.status_code == 200
        assert len(issues) == 2
        assert int(issues[0]['id']) == group2.id
        assert int(issues[1]['id']) == group.id

    def test_lookup_by_release(self):
        self.login_as(self.user)
        project = self.project
        release = Release.objects.create(organization=project.organization, version='12345')
        release.add_project(project)
        self.create_event(
            group=self.group,
            datetime=self.min_ago,
            tags={'sentry:release': release.version},
        )

        url = '%s?query=%s' % (self.path, quote('release:"%s"' % release.version))
        response = self.client.get(url, format='json')
        issues = json.loads(response.content)
        assert response.status_code == 200
        assert len(issues) == 1
        assert int(issues[0]['id']) == self.group.id

    def test_pending_delete_pending_merge_excluded(self):
        group = self.create_group(
            checksum='a' * 32,
            status=GroupStatus.PENDING_DELETION,
        )
        self.create_event(
            group=group,
            datetime=self.min_ago,
            data={'checksum': 'a' * 32},
        )
        group2 = self.create_group(
            checksum='b' * 32,
        )
        self.create_event(
            group=group2,
            datetime=self.min_ago,
            data={'checksum': 'b' * 32},
        )
        group3 = self.create_group(
            checksum='c' * 32,
            status=GroupStatus.DELETION_IN_PROGRESS,
        )
        self.create_event(
            group=group3,
            datetime=self.min_ago,
            data={'checksum': 'c' * 32},
        )
        group4 = self.create_group(
            checksum='d' * 32,
            status=GroupStatus.PENDING_MERGE,
        )
        self.create_event(
            group=group4,
            datetime=self.min_ago,
            data={'checksum': 'd' * 32},
        )

        self.login_as(user=self.user)

        response = self.client.get(self.path, format='json')
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(group2.id)

    def test_filters_based_on_retention(self):
        self.login_as(user=self.user)

        self.create_group(last_seen=timezone.now() - timedelta(days=2))

        with self.options({'system.event-retention-days': 1}):
            response = self.client.get(self.path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_token_auth(self):
        token = ApiToken.objects.create(user=self.user, scope_list=['org:read'])
        response = self.client.get(
            self.path,
            format='json',
            HTTP_AUTHORIZATION='Bearer %s' %
            token.token)
        assert response.status_code == 200, response.content

    def test_date_range(self):
        now = timezone.now()
        with self.options({'system.event-retention-days': 2}):
            group = self.create_group(
                last_seen=now - timedelta(hours=5),
                # first_seen needs to be accurate because of `shrink_time_window`
                first_seen=now - timedelta(hours=5),
                project=self.project,
            )

            self.create_event(
                group=group,
                datetime=now - timedelta(hours=5),
            )
            self.login_as(user=self.user)

            response = self.client.get(
                '%s?statsPeriod=6h' % (self.path,),
                format='json',
            )
            assert len(response.data) == 1
            assert response.data[0]['id'] == six.text_type(group.id)

            response = self.client.get(
                '%s?statsPeriod=1h' % (self.path,),
                format='json',
            )

            assert len(response.data) == 0
