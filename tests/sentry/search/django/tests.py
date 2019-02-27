# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import datetime, timedelta

import pytest
from django.conf import settings

from sentry import tagstore
from sentry.api.issue_search import (
    convert_query_values,
    parse_search_query,
)
from sentry.models import (
    Environment, Event, Group, GroupAssignee, GroupBookmark, GroupEnvironment,
    GroupStatus, GroupSubscription
)
from sentry.search.base import ANY
from sentry.search.django.backend import DjangoSearchBackend
from sentry.tagstore.v2.backend import AGGREGATE_ENVIRONMENT_ID
from sentry.testutils import TestCase


def date_to_query_format(date):
    return date.strftime('%Y-%m-%dT%H:%M:%S')


class DjangoSearchBackendTest(TestCase):

    def create_backend(self):
        return DjangoSearchBackend()

    def setUp(self):
        self.backend = self.create_backend()
        now = datetime.now()

        self.event1 = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'event_id': 'a' * 32,
                'message': 'foo',
                'environment': 'production',
                'tags': {
                    'server': 'example.com',
                },
                'timestamp': (now - timedelta(days=10)).isoformat()[:19]
            },
            project_id=self.project.id
        )

        self.event3 = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'event_id': 'c' * 32,
                'message': 'foo',
                'environment': 'production',
                'tags': {
                    'server': 'example.com',
                },
                'timestamp': (now - timedelta(days=2)).isoformat()[:19]
            },
            project_id=self.project.id
        )

        self.group1 = Group.objects.get(id=self.event3.group.id)
        assert self.event1.group.id == self.group1.id

        assert self.group1.first_seen == self.event1.datetime
        assert self.group1.last_seen == self.event3.datetime

        self.group1.status = GroupStatus.UNRESOLVED
        self.group1.times_seen = 5
        self.group1.save()

        self.event2 = self.store_event(
            data={
                'fingerprint': ['put-me-in-group2'],
                'event_id': 'b' * 32,
                'message': 'bar',
                'environment': 'staging',
                'tags': {
                    'server': 'example.com',
                    'url': 'http://example.com',
                },
                'timestamp': (now - timedelta(days=9)).isoformat()[:19]
            },
            project_id=self.project.id
        )

        self.group2 = Group.objects.get(id=self.event2.group.id)
        assert self.group2.first_seen == self.event2.datetime
        assert self.group2.last_seen == self.event2.datetime
        self.group2.status = GroupStatus.RESOLVED
        self.group2.times_seen = 10
        self.group2.save()

        self.environments = {}

        for event in Event.objects.filter(project_id=self.project.id):
            self._setup_tags_for_event(event)

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

    def _setup_tags_for_event(self, event):
        tags = dict(event.data.get('tags') or ())

        try:
            environment = self.environments[event.data['environment']]
        except KeyError:
            environment = self.environments[event.data['environment']] = Environment.get_or_create(
                event.project,
                event.data['environment'],
            )

        GroupEnvironment.objects.get_or_create(
            environment_id=environment.id,
            group_id=event.group_id,
        )

        for key, value in tags.items():
            for environment_id in [AGGREGATE_ENVIRONMENT_ID, environment.id]:
                tag_value, created = tagstore.get_or_create_group_tag_value(
                    project_id=event.project_id,
                    group_id=event.group_id,
                    environment_id=environment_id,
                    key=key,
                    value=value,
                )

                if created:  # XXX: Hack for tagstore compat
                    tag_value.update(
                        times_seen=1,
                        first_seen=event.datetime,
                        last_seen=event.datetime,
                    )
                else:
                    updates = {
                        'times_seen': tag_value.times_seen + 1,
                    }

                    if event.datetime < tag_value.first_seen:
                        updates['first_seen'] = event.datetime

                    if event.datetime > tag_value.last_seen:
                        updates['last_seen'] = event.datetime

                    if updates:
                        tag_value.update(**updates)

                tagstore.create_event_tags(
                    project_id=event.project_id,
                    group_id=event.group_id,
                    environment_id=environment_id,
                    event_id=event.id,
                    tags=tags.items(),
                    date_added=event.datetime,
                )

    def make_query(self, projects=None, search_filter_query=None, environments=None, **kwargs):
        search_filters = []
        if search_filter_query is not None:
            search_filters = self.build_search_filter(search_filter_query, projects, environments)
        return self.backend.query(
            projects if projects is not None else [self.project],
            search_filters=search_filters,
            environments=environments,
            **kwargs
        )

    def build_search_filter(self, query, projects=None, user=None, environments=None):
        user = user if user is not None else self.user
        projects = projects if projects is not None else [self.project]
        return convert_query_values(parse_search_query(query), projects, user, environments)

    def test_query(self):
        results = self.make_query(search_filter_query='foo', query='foo')
        assert set(results) == set([self.group1])

        results = self.make_query(search_filter_query='bar', query='bar')
        assert set(results) == set([self.group2])

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

    def test_sort(self):
        results = self.make_query(sort_by='date')
        assert list(results) == [self.group1, self.group2]

        results = self.make_query(sort_by='new')
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(sort_by='freq')
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(sort_by='priority')
        assert list(results) == [self.group1, self.group2]

    def test_sort_with_environment(self):
        for dt in [
                self.group1.first_seen + timedelta(days=1),
                self.group1.first_seen + timedelta(days=2),
                self.group1.last_seen + timedelta(days=1)]:
            event = self.store_event(
                data={
                    'fingerprint': ['put-me-in-group2'],
                    'message': 'foo',
                    'environment': 'production',
                    'tags': {
                        'server': 'example.com',
                    },
                    'timestamp': dt.isoformat()[:19]
                },
                project_id=self.project.id
            )
            self._setup_tags_for_event(event)

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
            search_filter_query='environment:staging has:server',
            tags={'environment': 'staging', 'server': ANY},
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            search_filter_query='environment:staging server:bar.example.com',
            tags={'environment': 'staging',
                  'server': 'bar.example.com'})
        assert set(results) == set([])

    def test_environment_tag_not_matching_project(self):
        project = self.create_project(name='other')
        results = self.make_query(
            [project],
            environments=[self.environments['production']],
            tags={'environment': 'production'},
            search_filter_query='',
            query='',
        )
        assert set(results) == set([])

    def test_tags_with_environment(self):
        results = self.make_query(
            environments=[self.environments['production']],
            tags={'server': 'example.com'})
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments['staging']],
            tags={'server': 'example.com'})
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments['staging']],
            tags={'server': ANY})
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments['staging']],
            tags={
                'environment': ANY,
                'server': ANY,
            })
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments['production']],
            tags={'url': 'http://example.com'})
        assert set(results) == set([])

        results = self.make_query(
            environments=[self.environments['staging']],
            tags={'url': 'http://example.com'})
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments['staging']],
            tags={'server': 'bar.example.com'})
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
        results = self.make_query(limit=1, sort_by='date')
        assert set(results) == set([self.group1])

        results = self.make_query(cursor=results.next, limit=1, sort_by='date')
        assert set(results) == set([self.group2])

        results = self.make_query(cursor=results.next, limit=1, sort_by='date')
        assert set(results) == set([])

    def test_pagination_with_environment(self):
        for dt in [
                self.group1.first_seen + timedelta(days=1),
                self.group1.first_seen + timedelta(days=2),
                self.group1.last_seen + timedelta(days=1)]:
            event = self.store_event(
                data={
                    'environment': 'production',
                    'fingerprint': ['put-me-in-group2'],
                    'message': 'bar',
                    'timestamp': dt.isoformat()[:19]
                },
                project_id=self.project.id
            )
            self._setup_tags_for_event(event)

        results = self.make_query(
            environments=[self.environments['production']],
            sort_by='date',
            limit=1,
            count_hits=True,
        )
        assert list(results) == [self.group2]
        assert results.hits == 2

        results = self.make_query(
            environments=[self.environments['production']],
            sort_by='date',
            limit=1,
            cursor=results.next,
            count_hits=True,
        )
        assert list(results) == [self.group1]
        assert results.hits == 2

        results = self.make_query(
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

        event = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'message': 'foo',
                'environment': 'development',
                'tags': {
                    'server': 'example.com',
                },
                'timestamp': (self.group1.first_seen + timedelta(days=1)).isoformat()[:19]
            },
            project_id=self.project.id
        )

        self._setup_tags_for_event(event)

        results = self.make_query(
            environments=[self.environments['production']],
            age_from=self.group1.first_seen,
            age_from_inclusive=False,
            search_filter_query='firstSeen:>%s' % date_to_query_format(self.group1.first_seen),
        )
        assert set(results) == set([])

        results = self.make_query(
            environments=[self.environments['development']],
            age_from=self.group1.first_seen,
            age_from_inclusive=False,
            search_filter_query='firstSeen:>%s' % date_to_query_format(self.group1.first_seen),
        )
        assert set(results) == set([self.group1])

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

        event = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'message': 'foo',
                'environment': 'development',
                'tags': {
                    'server': 'example.com',
                },
                'timestamp': (self.group1.last_seen + timedelta(days=1)).isoformat()[:19]
            },
            project_id=self.project.id
        )

        self._setup_tags_for_event(event)

        results = self.make_query(
            environments=[self.environments['production']],
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=False,
            search_filter_query='lastSeen:>%s' % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([])

        results = self.make_query(
            environments=[self.environments['development']],
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=False,
            search_filter_query='lastSeen:>%s' % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([self.group1])

    def test_date_filter(self):
        results = self.make_query(
            date_from=self.event2.datetime,
            search_filter_query='event.timestamp:>=%s' % date_to_query_format(self.event2.datetime),
        )
        assert set(results) == set([self.group1, self.group2])

        results = self.make_query(
            date_to=self.event1.datetime + timedelta(minutes=1),
            search_filter_query='event.timestamp:<=%s' % date_to_query_format(
                self.event1.datetime + timedelta(minutes=1),
            ),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
            search_filter_query='event.timestamp:>=%s event.timestamp:<=%s' % (
                date_to_query_format(self.event1.datetime),
                date_to_query_format(self.event2.datetime + timedelta(minutes=1)),
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
