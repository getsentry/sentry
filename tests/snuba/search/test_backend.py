from __future__ import absolute_import

import mock
import pytz
import pytest
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from hashlib import md5

from sentry import options
from sentry.api.issue_search import (
    convert_query_values,
    IssueSearchVisitor,
    parse_search_query,
)
from sentry.models import (
    Environment, Group, GroupAssignee, GroupBookmark, GroupEnvironment,
    GroupStatus, GroupSubscription
)
from sentry.search.base import ANY
from sentry.search.snuba.backend import SnubaSearchBackend
from sentry.testutils import (
    SnubaTestCase,
    xfail_if_not_postgres,
)
from sentry.utils.snuba import (
    SENTRY_SNUBA_MAP,
    SnubaError,
)


def date_to_query_format(date):
    return date.strftime('%Y-%m-%dT%H:%M:%S')


class SnubaSearchTest(SnubaTestCase):
    def setUp(self):
        super(SnubaSearchTest, self).setUp()
        self.backend = SnubaSearchBackend()
        self.base_datetime = (datetime.utcnow() - timedelta(days=3)).replace(tzinfo=pytz.utc)

        self.event1 = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'event_id': 'a' * 32,
                'message': 'foo',
                'environment': 'production',
                'tags': {
                    'server': 'example.com',
                },
                'timestamp': (self.base_datetime - timedelta(days=21)).isoformat()[:19],
                'stacktrace': {
                    'frames': [{
                        'module': 'group1'
                    }]
                },
            },
            project_id=self.project.id,
        )
        self.event3 = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'event_id': 'c' * 32,
                'message': 'group1',
                'environment': 'production',
                'tags': {
                    'server': 'example.com',
                },
                'timestamp': self.base_datetime.isoformat()[:19],
                'stacktrace': {
                    'frames': [{
                        'module': 'group1'
                    }]
                },
            },
            project_id=self.project.id,
        )

        self.group1 = Group.objects.get(id=self.event1.group.id)
        assert self.group1.id == self.event3.group.id

        assert self.group1.first_seen == self.event1.datetime
        assert self.group1.last_seen == self.event3.datetime

        self.group1.times_seen = 5
        self.group1.status = GroupStatus.UNRESOLVED
        self.group1.save()

        self.event2 = self.store_event(
            data={
                'fingerprint': ['put-me-in-group2'],
                'event_id': 'b' * 32,
                'timestamp': (self.base_datetime - timedelta(days=20)).isoformat()[:19],
                'message': 'bar',
                'stacktrace': {
                    'frames': [{
                        'module': 'group2'
                    }]
                },
                'environment': 'staging',
                'tags': {
                    'server': 'example.com',
                    'url': 'http://example.com',
                }
            },
            project_id=self.project.id
        )

        self.group2 = Group.objects.get(id=self.event2.group.id)

        assert self.group2.first_seen == self.group2.last_seen == self.event2.datetime

        self.group2.status = GroupStatus.RESOLVED
        self.group2.times_seen = 10
        self.group2.save()

        GroupBookmark.objects.create(
            user=self.user,
            group=self.group2,
            project=self.group2.project,
        )

        GroupAssignee.objects.create(
            user=self.user,
            group=self.group2,
            project=self.group2.project,
        )

        GroupSubscription.objects.create(
            user=self.user,
            group=self.group1,
            project=self.group1.project,
            is_active=True,
        )

        GroupSubscription.objects.create(
            user=self.user,
            group=self.group2,
            project=self.group2.project,
            is_active=False,
        )

        self.environments = {
            'production': self.event1.get_environment(),
            'staging': self.event2.get_environment(),
        }

    def set_up_multi_project(self):
        self.project2 = self.create_project(organization=self.project.organization)
        self.event_p2 = self.store_event(
            data={
                'event_id': 'a' * 32,
                'fingerprint': ['put-me-in-groupP2'],
                'timestamp': (self.base_datetime - timedelta(days=21)).isoformat()[:19],
                'message': 'foo',
                'stacktrace': {
                    'frames': [{
                        'module': 'group_p2'
                    }]
                },
                'tags': {
                    'server': 'example.com',
                },
                'environment': 'production',
            },
            project_id=self.project2.id
        )

        self.group_p2 = Group.objects.get(id=self.event_p2.group.id)
        self.group_p2.times_seen = 6
        self.group_p2.last_seen = self.base_datetime - timedelta(days=1)
        self.group_p2.save()

    def build_search_filter(self, query, projects=None, user=None, environments=None):
        user = user if user is not None else self.user
        projects = projects if projects is not None else [self.project]
        return convert_query_values(parse_search_query(query), projects, user, environments)

    def make_query(self, projects=None, search_filter_query=None, environments=None, **kwargs):
        search_filters = []
        projects = projects if projects is not None else [self.project]
        if search_filter_query is not None:
            search_filters = self.build_search_filter(
                search_filter_query,
                projects,
                environments=environments,
            )
        return self.backend.query(
            projects,
            search_filters=search_filters,
            environments=environments,
            **kwargs
        )

    def test_query(self):
        results = self.make_query(search_filter_query='foo', query='foo')
        assert set(results) == set([self.group1])

        results = self.make_query(search_filter_query='bar', query='bar')
        assert set(results) == set([self.group2])

    def test_query_multi_project(self):
        self.set_up_multi_project()
        results = self.make_query(
            [self.project, self.project2],
            search_filter_query='foo',
            query='foo',
        )
        assert set(results) == set([self.group1, self.group_p2])

    def test_query_with_environment(self):
        results = self.make_query(
            environments=[self.environments['production']],
            search_filter_query='foo',
            query='foo',
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments['production']],
            search_filter_query='bar',
            query='bar',
        )
        assert set(results) == set([])

        results = self.make_query(
            environments=[self.environments['staging']],
            search_filter_query='bar',
            query='bar',
        )
        assert set(results) == set([self.group2])

    def test_multi_environments(self):
        self.set_up_multi_project()
        results = self.make_query(
            [self.project, self.project2],
            environments=[
                self.environments['production'],
                self.environments['staging'],
            ])
        assert set(results) == set([self.group1, self.group2, self.group_p2])

    def test_query_with_environment_multi_project(self):
        self.set_up_multi_project()
        results = self.make_query(
            [self.project, self.project2],
            environments=[self.environments['production']],
            search_filter_query='foo',
            query='foo',
        )
        assert set(results) == set([self.group1, self.group_p2])

        results = self.make_query(
            [self.project, self.project2],
            environments=[self.environments['production']],
            search_filter_query='bar',
            query='bar',
        )
        assert set(results) == set([])

    def test_sort(self):
        results = self.make_query(sort_by='date')
        assert list(results) == [self.group1, self.group2]

        results = self.make_query(sort_by='new')
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(sort_by='freq')
        assert list(results) == [self.group1, self.group2]

        results = self.make_query(sort_by='priority')
        assert list(results) == [self.group1, self.group2]

    def test_sort_multi_project(self):
        self.set_up_multi_project()
        results = self.make_query([self.project, self.project2], sort_by='date')
        assert list(results) == [self.group1, self.group_p2, self.group2]

        results = self.make_query([self.project, self.project2], sort_by='new')
        assert list(results) == [self.group2, self.group_p2, self.group1]

        results = self.make_query([self.project, self.project2], sort_by='freq')
        assert list(results) == [self.group1, self.group_p2, self.group2]

        results = self.make_query([self.project, self.project2], sort_by='priority')
        assert list(results) == [self.group1, self.group2, self.group_p2]

    def test_sort_with_environment(self):
        for dt in [
                self.group1.first_seen + timedelta(days=1),
                self.group1.first_seen + timedelta(days=2),
                self.group1.last_seen + timedelta(days=1)]:
            self.store_event(
                data={
                    'fingerprint': ['put-me-in-group2'],
                    'timestamp': dt.isoformat()[:19],
                    'stacktrace': {
                        'frames': [{
                            'module': 'group2'
                        }]
                    },
                    'environment': 'production',
                    'message': 'group2'
                },
                project_id=self.project.id
            )

        results = self.make_query(
            environments=[self.environments['production']],
            sort_by='date',
        )
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(
            environments=[self.environments['production']],
            sort_by='new',
        )
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(
            environments=[self.environments['production']],
            sort_by='freq',
        )
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(
            environments=[self.environments['production']],
            sort_by='priority',
        )
        assert list(results) == [self.group2, self.group1]

    def test_status(self):
        results = self.make_query(
            search_filter_query='is:unresolved',
            status=GroupStatus.UNRESOLVED,
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            search_filter_query='is:resolved',
            status=GroupStatus.RESOLVED,
        )
        assert set(results) == set([self.group2])

    def test_status_with_environment(self):
        results = self.make_query(
            environments=[self.environments['production']],
            search_filter_query='is:unresolved',
            status=GroupStatus.UNRESOLVED,
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments['staging']],
            search_filter_query='is:resolved',
            status=GroupStatus.RESOLVED,
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments['production']],
            status=GroupStatus.RESOLVED,
            search_filter_query='is:resolved',
        )
        assert set(results) == set([])

    def test_tags(self):
        results = self.make_query(
            search_filter_query='environment:staging',
            tags={'environment': 'staging'},
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            search_filter_query='environment:example.com',
            tags={'environment': 'example.com'},
        )
        assert set(results) == set([])

        results = self.make_query(
            search_filter_query='has:environment',
            tags={'environment': ANY},
        )
        assert set(results) == set([self.group2, self.group1])

        results = self.make_query(
            search_filter_query='environment:staging server:example.com',
            tags={'environment': 'staging', 'server': 'example.com'},
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            search_filter_query='url:"http://example.com"',
            tags={'url': 'http://example.com'},
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            search_filter_query='environment:staging has:server',
            tags={'environment': 'staging', 'server': ANY},
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            search_filter_query='environment:staging server:bar.example.com',
            tags={'environment': 'staging', 'server': 'bar.example.com'},
        )
        assert set(results) == set([])

    def test_tags_with_environment(self):
        results = self.make_query(
            environments=[self.environments['production']],
            search_filter_query='server:example.com',
            tags={'server': 'example.com'},
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments['staging']],
            search_filter_query='server:example.com',
            tags={'server': 'example.com'},
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments['staging']],
            search_filter_query='has:server',
            tags={'server': ANY},
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments['production']],
            search_filter_query='url:"http://example.com"',
            tags={'url': 'http://example.com'})
        assert set(results) == set([])

        results = self.make_query(
            environments=[self.environments['staging']],
            search_filter_query='url:"http://example.com"',
            tags={'url': 'http://example.com'},
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments['staging']],
            search_filter_query='server:bar.example.com',
            tags={'server': 'bar.example.com'},
        )
        assert set(results) == set([])

    def test_bookmarked_by(self):
        results = self.make_query(
            bookmarked_by=self.user,
            search_filter_query='bookmarks:%s' % self.user.username,
        )
        assert set(results) == set([self.group2])

    def test_bookmarked_by_with_environment(self):
        results = self.make_query(
            environments=[self.environments['staging']],
            bookmarked_by=self.user,
            search_filter_query='bookmarks:%s' % self.user.username,
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments['production']],
            bookmarked_by=self.user,
            search_filter_query='bookmarks:%s' % self.user.username,
        )
        assert set(results) == set([])

    def test_project(self):
        results = self.make_query([self.create_project(name='other')])
        assert set(results) == set([])

    def test_pagination(self):
        for options_set in [
            {'snuba.search.min-pre-snuba-candidates': None},
            {'snuba.search.min-pre-snuba-candidates': 500}
        ]:
            with self.options(options_set):
                results = self.backend.query([self.project], limit=1, sort_by='date')
                assert set(results) == set([self.group1])
                assert not results.prev.has_results
                assert results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by='date')
                assert set(results) == set([self.group2])
                assert results.prev.has_results
                assert not results.next.has_results

                # note: previous cursor
                results = self.backend.query(
                    [self.project], cursor=results.prev, limit=1, sort_by='date')
                assert set(results) == set([self.group1])
                assert results.prev.has_results
                assert results.next.has_results

                # note: previous cursor, paging too far into 0 results
                results = self.backend.query(
                    [self.project], cursor=results.prev, limit=1, sort_by='date')
                assert set(results) == set([])
                assert not results.prev.has_results
                assert results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by='date')
                assert set(results) == set([self.group1])
                assert results.prev.has_results
                assert results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by='date')
                assert set(results) == set([self.group2])
                assert results.prev.has_results
                assert not results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by='date')
                assert set(results) == set([])
                assert results.prev.has_results
                assert not results.next.has_results

    def test_pagination_with_environment(self):
        for dt in [
                self.group1.first_seen + timedelta(days=1),
                self.group1.first_seen + timedelta(days=2),
                self.group1.last_seen + timedelta(days=1)]:
            self.store_event(
                data={
                    'fingerprint': ['put-me-in-group2'],
                    'timestamp': dt.isoformat()[:19],
                    'environment': 'production',
                    'message': 'group2',
                    'stacktrace': {
                        'frames': [{
                            'module': 'group2'
                        }]
                    },
                },
                project_id=self.project.id
            )

        results = self.backend.query(
            [self.project],
            environments=[self.environments['production']],
            sort_by='date',
            limit=1,
            count_hits=True,
        )
        assert list(results) == [self.group2]
        assert results.hits == 2

        results = self.backend.query(
            [self.project],
            environments=[self.environments['production']],
            sort_by='date',
            limit=1,
            cursor=results.next,
            count_hits=True,
        )
        assert list(results) == [self.group1]
        assert results.hits == 2

        results = self.backend.query(
            [self.project],
            environments=[self.environments['production']],
            sort_by='date',
            limit=1,
            cursor=results.next,
            count_hits=True,
        )
        assert list(results) == []
        assert results.hits == 2

    def test_active_at_filter(self):
        results = self.make_query(
            active_at_from=self.group2.active_at,
            active_at_inclusive=True,
            search_filter_query='activeSince:>=%s' % date_to_query_format(self.group2.active_at),
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            active_at_to=self.group1.active_at + timedelta(minutes=1),
            active_at_inclusive=True,
            search_filter_query='activeSince:<=%s' % date_to_query_format(
                self.group1.active_at + timedelta(minutes=1),
            ),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            active_at_from=self.group1.active_at,
            active_at_from_inclusive=True,
            active_at_to=self.group1.active_at + timedelta(minutes=1),
            active_at_to_inclusive=True,
            search_filter_query='activeSince:>=%s activeSince:<=%s' % (
                date_to_query_format(self.group1.active_at),
                date_to_query_format(self.group1.active_at + timedelta(minutes=1)),
            )
        )
        assert set(results) == set([self.group1])

    def test_age_filter(self):
        results = self.make_query(
            age_from=self.group2.first_seen,
            age_from_inclusive=True,
            search_filter_query='firstSeen:>=%s' % date_to_query_format(self.group2.first_seen),
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            age_to=self.group1.first_seen + timedelta(minutes=1),
            age_to_inclusive=True,
            search_filter_query='firstSeen:<=%s' % date_to_query_format(
                self.group1.first_seen + timedelta(minutes=1),
            ),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            age_from=self.group1.first_seen,
            age_from_inclusive=True,
            age_to=self.group1.first_seen + timedelta(minutes=1),
            age_to_inclusive=True,
            search_filter_query='firstSeen:>=%s firstSeen:<=%s' % (
                date_to_query_format(self.group1.first_seen),
                date_to_query_format(self.group1.first_seen + timedelta(minutes=1)),
            )
        )
        assert set(results) == set([self.group1])

    def test_age_filter_with_environment(self):
        results = self.make_query(
            environments=[self.environments['production']],
            age_from=self.group1.first_seen,
            age_from_inclusive=True,
            search_filter_query='firstSeen:>=%s' % date_to_query_format(self.group1.first_seen),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments['production']],
            age_to=self.group1.first_seen,
            age_to_inclusive=True,
            search_filter_query='firstSeen:<=%s' % date_to_query_format(self.group1.first_seen),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments['production']],
            age_from=self.group1.first_seen,
            age_from_inclusive=False,
            search_filter_query='firstSeen:>%s' % date_to_query_format(self.group1.first_seen),
        )
        assert set(results) == set([])

        self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'timestamp': (self.group1.first_seen + timedelta(days=1)).isoformat()[:19],
                'message': 'group1',
                'stacktrace': {
                    'frames': [{
                        'module': 'group1'
                    }]
                },
                'environment': 'development'
            },
            project_id=self.project.id
        )

        results = self.make_query(
            environments=[self.environments['production']],
            age_from=self.group1.first_seen,
            age_from_inclusive=False,
            search_filter_query='firstSeen:>%s' % date_to_query_format(self.group1.first_seen),
        )
        assert set(results) == set([])

        results = self.make_query(
            environments=[Environment.objects.get(name='development')],
            age_from=self.group1.first_seen,
            age_from_inclusive=False,
            search_filter_query='firstSeen:>%s' % date_to_query_format(self.group1.first_seen),
        )
        assert set(results) == set([self.group1])

    def test_times_seen_filter(self):
        results = self.make_query(
            [self.project],
            times_seen=2,
            search_filter_query='times_seen:2',
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            [self.project],
            times_seen_lower=2,
            search_filter_query='times_seen:>=2',
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            [self.project],
            times_seen_upper=1,
            search_filter_query='times_seen:<=1',
        )
        assert set(results) == set([self.group2])

    def test_last_seen_filter(self):
        results = self.make_query(
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=True,
            search_filter_query='lastSeen:>=%s' % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=True,
            last_seen_to=self.group1.last_seen + timedelta(minutes=1),
            last_seen_to_inclusive=True,
            search_filter_query='lastSeen:>=%s lastSeen:<=%s' % (
                date_to_query_format(self.group1.last_seen),
                date_to_query_format(self.group1.last_seen + timedelta(minutes=1)),
            )
        )
        assert set(results) == set([self.group1])

    def test_last_seen_filter_with_environment(self):
        results = self.make_query(
            environments=[self.environments['production']],
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=True,
            search_filter_query='lastSeen:>=%s' % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments['production']],
            last_seen_to=self.group1.last_seen,
            last_seen_to_inclusive=True,
            search_filter_query='lastSeen:<=%s' % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments['production']],
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=False,
            search_filter_query='lastSeen:>%s' % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([])

        self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'timestamp': (self.group1.last_seen + timedelta(days=1)).isoformat()[:19],
                'message': 'group1',
                'stacktrace': {
                    'frames': [{
                        'module': 'group1'
                    }]
                },
                'environment': 'development',
            },
            project_id=self.project.id
        )

        self.group1.update(last_seen=self.group1.last_seen + timedelta(days=1))

        results = self.make_query(
            environments=[self.environments['production']],
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=False,
            search_filter_query='lastSeen:>%s' % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([])

        results = self.make_query(
            environments=[Environment.objects.get(name='development')],
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=False,
            search_filter_query='lastSeen:>%s' % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set()

        results = self.backend.query(
            [self.project],
            date_to=self.group1.last_seen + timedelta(days=1),
            environments=[Environment.objects.get(name='development')],
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=True,
            search_filter_query='lastSeen:>=%s' % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([self.group1])

    def test_date_filter(self):
        results = self.make_query(
            date_from=self.event2.datetime,
            search_filter_query='timestamp:>=%s' % date_to_query_format(self.event2.datetime),
        )
        assert set(results) == set([self.group1, self.group2])

        results = self.make_query(
            date_to=self.event1.datetime + timedelta(minutes=1),
            search_filter_query='timestamp:<=%s' % date_to_query_format(
                self.event1.datetime + timedelta(minutes=1),
            ),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
            search_filter_query='timestamp:>=%s timestamp:<=%s' % (
                date_to_query_format(self.event1.datetime),
                date_to_query_format(self.event2.datetime + timedelta(minutes=1)),
            )
        )
        assert set(results) == set([self.group1, self.group2])

        # Test with `Z` utc marker, should be equivalent
        results = self.make_query(
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
            search_filter_query='timestamp:>=%s timestamp:<=%s' % (
                date_to_query_format(self.event1.datetime) + 'Z',
                date_to_query_format(self.event2.datetime + timedelta(minutes=1)) + 'Z',
            )
        )
        assert set(results) == set([self.group1, self.group2])

    @pytest.mark.xfail(
        not settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.v2'),
        reason='unsupported on legacy backend due to insufficient index',
    )
    def test_date_filter_with_environment(self):
        results = self.backend.query(
            [self.project],
            environments=[self.environments['production']],
            date_from=self.event2.datetime,
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            [self.project],
            environments=[self.environments['production']],
            date_to=self.event1.datetime + timedelta(minutes=1),
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            [self.project],
            environments=[self.environments['staging']],
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
        )
        assert set(results) == set([self.group2])

    def test_unassigned(self):
        results = self.make_query(
            unassigned=True,
            search_filter_query='is:unassigned',
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            unassigned=False,
            search_filter_query='is:assigned',
        )
        assert set(results) == set([self.group2])

    def test_unassigned_with_environment(self):
        results = self.make_query(
            environments=[self.environments['production']],
            unassigned=True,
            search_filter_query='is:unassigned',
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments['staging']],
            unassigned=False,
            search_filter_query='is:assigned',
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments['production']],
            unassigned=False,
            search_filter_query='is:assigned',
        )
        assert set(results) == set([])

    def test_assigned_to(self):
        results = self.make_query(
            assigned_to=self.user,
            search_filter_query='assigned:%s' % self.user.username,
        )
        assert set(results) == set([self.group2])

        # test team assignee
        ga = GroupAssignee.objects.get(
            user=self.user,
            group=self.group2,
            project=self.group2.project,
        )
        ga.update(team=self.team, user=None)
        assert GroupAssignee.objects.get(id=ga.id).user is None

        results = self.make_query(
            assigned_to=self.user,
            search_filter_query='assigned:%s' % self.user.username,
        )
        assert set(results) == set([self.group2])

        # test when there should be no results
        other_user = self.create_user()
        results = self.make_query(
            assigned_to=other_user,
            search_filter_query='assigned:%s' % other_user.username
        )
        assert set(results) == set([])

        owner = self.create_user()
        self.create_member(
            organization=self.project.organization,
            user=owner,
            role='owner',
            teams=[],
        )

        # test that owners don't see results for all teams
        results = self.make_query(
            assigned_to=owner,
            search_filter_query='assigned:%s' % owner.username
        )
        assert set(results) == set([])

    def test_assigned_to_with_environment(self):
        results = self.make_query(
            environments=[self.environments['staging']],
            assigned_to=self.user,
            search_filter_query='assigned:%s' % self.user.username
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments['production']],
            assigned_to=self.user,
            search_filter_query='assigned:%s' % self.user.username
        )
        assert set(results) == set([])

    def test_subscribed_by(self):
        results = self.make_query(
            [self.group1.project],
            subscribed_by=self.user,
            search_filter_query='subscribed:%s' % self.user.username
        )
        assert set(results) == set([self.group1])

    def test_subscribed_by_with_environment(self):
        results = self.make_query(
            [self.group1.project],
            environments=[self.environments['production']],
            subscribed_by=self.user,
            search_filter_query='subscribed:%s' % self.user.username
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            [self.group1.project],
            environments=[self.environments['staging']],
            subscribed_by=self.user,
            search_filter_query='subscribed:%s' % self.user.username
        )
        assert set(results) == set([])

    @mock.patch('sentry.utils.snuba.raw_query')
    def test_snuba_not_called_optimization(self, query_mock):
        assert self.make_query(query='foo', search_filter_query='foo').results == [self.group1]
        assert not query_mock.called

        assert self.make_query(
            search_filter_query='last_seen:>%s foo' % date_to_query_format(timezone.now()),
            query='foo',
            sort_by='date',
            last_seen_from=timezone.now(),
        ).results == []
        assert query_mock.called

    @mock.patch('sentry.utils.snuba.raw_query')
    def test_optimized_aggregates(self, query_mock):
        # TODO this test is annoyingly fragile and breaks in hard-to-see ways
        # any time anything about the snuba query changes
        query_mock.return_value = {'data': [], 'totals': {'total': 0}}

        def Any(cls):
            class Any(object):
                def __eq__(self, other):
                    return isinstance(other, cls)
            return Any()

        DEFAULT_LIMIT = 100
        chunk_growth = options.get('snuba.search.chunk-growth-rate')
        limit = int(DEFAULT_LIMIT * chunk_growth)

        common_args = {
            'start': Any(datetime),
            'end': Any(datetime),
            'filter_keys': {
                'project_id': [self.project.id],
                'issue': [self.group1.id]
            },
            'referrer': 'search',
            'groupby': ['issue'],
            'conditions': [[['positionCaseInsensitive', ['message', "'foo'"]], '!=', 0]],
            'selected_columns': [],
            'limit': limit,
            'offset': 0,
            'totals': True,
            'turbo': False,
            'sample': 1,
        }

        self.make_query(query='foo', search_filter_query='foo')
        assert not query_mock.called

        self.make_query(
            search_filter_query='last_seen:>=%s foo' % date_to_query_format(timezone.now()),
            query='foo',
            last_seen_from=timezone.now(),
            sort_by='date',
        )
        assert query_mock.call_args == mock.call(
            orderby=['-last_seen', 'issue'],
            aggregations=[
                ['uniq', 'issue', 'total'],
                ['toUInt64(max(timestamp)) * 1000', '', 'last_seen']
            ],
            having=[['last_seen', '>=', Any(int)]],
            **common_args
        )

        self.make_query(
            search_filter_query='foo',
            query='foo',
            sort_by='priority',
        )
        assert query_mock.call_args == mock.call(
            orderby=['-priority', 'issue'],
            aggregations=[
                ['(toUInt64(log(times_seen) * 600)) + last_seen', '', 'priority'],
                ['count()', '', 'times_seen'],
                ['uniq', 'issue', 'total'],
                ['toUInt64(max(timestamp)) * 1000', '', 'last_seen']
            ],
            having=[],
            **common_args
        )

        self.make_query(
            search_filter_query='times_seen:5 foo',
            query='foo',
            times_seen=5,
            sort_by='freq',
        )
        assert query_mock.call_args == mock.call(
            orderby=['-times_seen', 'issue'],
            aggregations=[
                ['count()', '', 'times_seen'],
                ['uniq', 'issue', 'total'],
            ],
            having=[['times_seen', '=', 5]],
            **common_args
        )

        self.make_query(
            search_filter_query='age:>=%s foo' % date_to_query_format(timezone.now()),
            query='foo',
            age_from=timezone.now(),
            sort_by='new',
        )
        assert query_mock.call_args == mock.call(
            orderby=['-first_seen', 'issue'],
            aggregations=[
                ['toUInt64(min(timestamp)) * 1000', '', 'first_seen'],
                ['uniq', 'issue', 'total'],
            ],
            having=[['first_seen', '>=', Any(int)]],
            **common_args
        )

    def test_pre_and_post_filtering(self):
        prev_max_pre = options.get('snuba.search.max-pre-snuba-candidates')
        options.set('snuba.search.max-pre-snuba-candidates', 1)
        try:
            # normal queries work as expected
            results = self.make_query(query='foo', search_filter_query='foo')
            assert set(results) == set([self.group1])
            results = self.make_query(query='bar', search_filter_query='bar')
            assert set(results) == set([self.group2])

            # no candidate matches in Sentry, immediately return empty paginator
            results = self.make_query(
                search_filter_query='NO MATCHES IN SENTRY',
                query='NO MATCHES IN SENTRY',
            )
            assert set(results) == set()

            # too many candidates, skip pre-filter, requires >1 postfilter queries
            results = self.make_query()
            assert set(results) == set([self.group1, self.group2])
        finally:
            options.set('snuba.search.max-pre-snuba-candidates', prev_max_pre)

    def test_optimizer_enabled(self):
        prev_optimizer_enabled = options.get('snuba.search.pre-snuba-candidates-optimizer')
        options.set('snuba.search.pre-snuba-candidates-optimizer', True)

        try:
            results = self.make_query(
                search_filter_query='server:example.com',
                environments=[self.environments['production']],
                tags={'server': 'example.com'})
            assert set(results) == set([self.group1])
        finally:
            options.set('snuba.search.pre-snuba-candidates-optimizer', prev_optimizer_enabled)

    def test_search_out_of_range(self):
        the_date = datetime(2000, 1, 1, 0, 0, 0, tzinfo=pytz.utc)
        results = self.make_query(
            search_filter_query='event.timestamp:>%s event.timestamp:<%s' % (the_date, the_date),
            date_from=the_date,
            date_to=the_date,
        )
        assert set(results) == set([])

    def test_hits_estimate(self):
        # 400 Groups/Events
        # Every 3rd one is Unresolved
        # Evey 2nd one has tag match=1
        for i in range(400):
            event = self.store_event(
                data={
                    'event_id': md5('event {}'.format(i)).hexdigest(),
                    'fingerprint': ['put-me-in-group{}'.format(i)],
                    'timestamp': (self.base_datetime - timedelta(days=21)).isoformat()[:19],
                    'message': 'group {} event'.format(i),
                    'stacktrace': {
                        'frames': [{
                            'module': 'module {}'.format(i)
                        }]
                    },
                    'tags': {
                        'match': '{}'.format(i % 2),
                    },
                    'environment': 'production',
                },
                project_id=self.project.id
            )

            group = event.group
            group.times_seen = 5
            group.status = GroupStatus.UNRESOLVED if i % 3 == 0 else GroupStatus.RESOLVED
            group.save()

        # Sample should estimate there are roughly 66 overall matching groups
        # based on a random sample of 100 (or $sample_size) of the total 200
        # snuba matches, of which 33% should pass the postgres filter.
        with self.options({
                # Too small to pass all django candidates down to snuba
                'snuba.search.max-pre-snuba-candidates': 5,
                'snuba.search.hits-sample-size': 50}):
            first_results = self.make_query(
                search_filter_query='is:unresolved match:1',
                status=GroupStatus.UNRESOLVED,
                tags={'match': '1'},
                limit=10,
                count_hits=True,
            )

            # Deliberately do not assert that the value is within some margin
            # of error, as this will fail tests at some rate corresponding to
            # our confidence interval.
            assert first_results.hits > 10

            # When searching for the same tags, we should get the same set of
            # hits as the sampling is based on the hash of the query.
            second_results = self.make_query(
                search_filter_query='is:unresolved match:1',
                status=GroupStatus.UNRESOLVED,
                tags={'match': '1'},
                limit=10,
                count_hits=True,
            )

            assert first_results.results == second_results.results

            # When using a different search, we should get a different sample
            # but still should have some hits.
            third_results = self.make_query(
                search_filter_query='is:unresolved match:0',
                status=GroupStatus.UNRESOLVED,
                tags={'match': '0'},
                limit=10,
                count_hits=True,
            )

            assert third_results.hits > 10
            assert third_results.results != second_results.results

    def test_first_release(self):
        results = self.make_query(
            first_release='fake',
            search_filter_query='first_release:%s' % 'fake',
        )
        assert set(results) == set([])

        release = self.create_release(self.project)

        results = self.make_query(
            first_release=release.version,
            search_filter_query='first_release:%s' % release.version,
        )
        assert set(results) == set([])

        self.group1.first_release = release
        self.group1.save()
        results = self.make_query(
            first_release=release.version,
            search_filter_query='first_release:%s' % release.version,
        )
        assert set(results) == set([self.group1])

    def test_first_release_environments(self):
        results = self.make_query(
            first_release='fake',
            environments=[self.environments['production']],
            search_filter_query='first_release:%s' % 'fake',
        )
        assert set(results) == set([])

        release = self.create_release(self.project)
        group_env = GroupEnvironment.get_or_create(
            group_id=self.group1.id,
            environment_id=self.environments['production'].id,
        )[0]

        results = self.make_query(
            first_release=release.version,
            environments=[self.environments['production']],
            search_filter_query='first_release:%s' % release.version,
        )
        assert set(results) == set([])

        group_env.first_release = release
        group_env.save()

        results = self.make_query(
            first_release=release.version,
            environments=[self.environments['production']],
            search_filter_query='first_release:%s' % release.version,
        )
        assert set(results) == set([self.group1])

    def test_query_enclosed_in_quotes(self):
        results = self.make_query(search_filter_query='"foo"', query='"foo"')
        assert set(results) == set([self.group1])

        results = self.make_query(search_filter_query='"bar"', query='"bar"')
        assert set(results) == set([self.group2])

    @xfail_if_not_postgres('Wildcard searching only supported in Postgres')
    def test_wildcard(self):
        escaped_event = self.store_event(
            data={
                'fingerprint': ['hello-there'],
                'event_id': 'f' * 32,
                'message': 'somet[hing]',
                'environment': 'production',
                'tags': {
                    'server': 'example.net',
                },
                'timestamp': self.base_datetime.isoformat()[:19],
                'stacktrace': {
                    'frames': [{
                        'module': 'group1'
                    }]
                },
            },
            project_id=self.project.id,
        )
        # Note: Adding in `environment:production` so that we make sure we query
        # in both snuba and postgres
        results = self.make_query(
            search_filter_query='environment:production so*t',
        )
        assert set(results) == set([escaped_event.group])
        # Make sure it's case insensitive
        results = self.make_query(
            search_filter_query='environment:production SO*t',
        )
        assert set(results) == set([escaped_event.group])
        results = self.make_query(
            search_filter_query='environment:production so*zz',
        )
        assert set(results) == set()
        results = self.make_query(
            search_filter_query='environment:production [hing]',
        )
        assert set(results) == set([escaped_event.group])
        results = self.make_query(
            search_filter_query='environment:production s*]',
        )
        assert set(results) == set([escaped_event.group])
        results = self.make_query(
            search_filter_query='environment:production server:example.*',
        )
        assert set(results) == set([self.group1, escaped_event.group])
        results = self.make_query(
            search_filter_query='environment:production !server:*net',
        )
        assert set(results) == set([self.group1])
        # TODO: Disabling tests that use [] syntax for the moment. Re-enable
        # these if we decide to add back in, or remove if this comment has been
        # here a while.
        # results = self.make_query(
        #     search_filter_query='environment:production [s][of][mz]',
        # )
        # assert set(results) == set([escaped_event.group])
        # results = self.make_query(
        #     search_filter_query='environment:production [z][of][mz]',
        # )
        # assert set(results) == set()

    def test_null_tags(self):
        tag_event = self.store_event(
            data={
                'fingerprint': ['hello-there'],
                'event_id': 'f' * 32,
                'message': 'something',
                'environment': 'production',
                'tags': {
                    'server': 'example.net',
                },
                'timestamp': self.base_datetime.isoformat()[:19],
                'stacktrace': {
                    'frames': [{
                        'module': 'group1'
                    }]
                },
            },
            project_id=self.project.id,
        )
        no_tag_event = self.store_event(
            data={
                'fingerprint': ['hello-there-2'],
                'event_id': '5' * 32,
                'message': 'something',
                'environment': 'production',
                'timestamp': self.base_datetime.isoformat()[:19],
                'stacktrace': {
                    'frames': [{
                        'module': 'group2'
                    }]
                },
            },
            project_id=self.project.id,
        )
        results = self.make_query(
            search_filter_query='environment:production !server:*net',
        )
        assert set(results) == set([self.group1, no_tag_event.group])
        results = self.make_query(
            search_filter_query='environment:production server:*net',
        )
        assert set(results) == set([tag_event.group])
        results = self.make_query(
            search_filter_query='environment:production !server:example.net',
        )
        assert set(results) == set([self.group1, no_tag_event.group])
        results = self.make_query(
            search_filter_query='environment:production server:example.net',
        )
        assert set(results) == set([tag_event.group])
        results = self.make_query(
            search_filter_query='environment:production has:server',
        )
        assert set(results) == set([self.group1, tag_event.group])
        results = self.make_query(
            search_filter_query='environment:production !has:server',
        )
        assert set(results) == set([no_tag_event.group])

    def test_null_promoted_tags(self):
        tag_event = self.store_event(
            data={
                'fingerprint': ['hello-there'],
                'event_id': 'f' * 32,
                'message': 'something',
                'environment': 'production',
                'tags': {
                    'logger': 'csp',
                },
                'timestamp': self.base_datetime.isoformat()[:19],
                'stacktrace': {
                    'frames': [{
                        'module': 'group1'
                    }]
                },
            },
            project_id=self.project.id,
        )
        no_tag_event = self.store_event(
            data={
                'fingerprint': ['hello-there-2'],
                'event_id': '5' * 32,
                'message': 'something',
                'environment': 'production',
                'timestamp': self.base_datetime.isoformat()[:19],
                'stacktrace': {
                    'frames': [{
                        'module': 'group2'
                    }]
                },
            },
            project_id=self.project.id,
        )
        results = self.make_query(
            search_filter_query='environment:production !logger:*sp',
        )
        assert set(results) == set([self.group1, no_tag_event.group])
        results = self.make_query(
            search_filter_query='environment:production logger:*sp',
        )
        assert set(results) == set([tag_event.group])
        results = self.make_query(
            search_filter_query='environment:production !logger:csp',
        )
        assert set(results) == set([self.group1, no_tag_event.group])
        results = self.make_query(
            search_filter_query='environment:production logger:csp',
        )
        assert set(results) == set([tag_event.group])
        results = self.make_query(
            search_filter_query='environment:production has:logger',
        )
        assert set(results) == set([tag_event.group])
        results = self.make_query(
            search_filter_query='environment:production !has:logger',
        )
        assert set(results) == set([self.group1, no_tag_event.group])

    def test_all_fields_do_not_error(self):
        # Just a sanity check to make sure that all fields can be succesfully
        # searched on without returning type errors and other schema related
        # issues.
        def test_query(query):
            try:
                self.make_query(search_filter_query=query)
            except SnubaError as e:
                self.fail('Query %s errored. Error info: %s' % (query, e))

        for key in SENTRY_SNUBA_MAP:
            if key == 'project.id':
                continue
            test_query('has:%s' % key)
            test_query('!has:%s' % key)
            if key in IssueSearchVisitor.numeric_keys:
                val = '123'
            elif key in IssueSearchVisitor.date_keys:
                val = '2019-01-01'
            else:
                val = 'hello'
                test_query('!%s:%s' % (key, val))

            test_query('%s:%s' % (key, val))
