# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import datetime, timedelta

from sentry import tagstore
from sentry.event_manager import ScoreClause
from sentry.models import (
    GroupAssignee, GroupBookmark, GroupStatus, GroupSubscription
)
from sentry.search.base import ANY
from sentry.search.django.backend import DjangoSearchBackend
from sentry.testutils import TestCase
from sentry.utils import tenants


class DjangoSearchBackendTest(TestCase):
    def create_backend(self):
        return DjangoSearchBackend()

    def setUp(self):
        self.backend = self.create_backend()

        self.group1 = self.create_group(
            project=self.project,
            checksum='a' * 32,
            message='foo',
            times_seen=5,
            status=GroupStatus.UNRESOLVED,
            last_seen=datetime(2013, 8, 13, 3, 8, 24, 880386),
            first_seen=datetime(2013, 7, 13, 3, 8, 24, 880386),
            score=ScoreClause.calculate(
                times_seen=5,
                last_seen=datetime(2013, 8, 13, 3, 8, 24, 880386),
            ),
        )

        self.event1 = self.create_event(
            event_id='a' * 32,
            group=self.group1,
            datetime=datetime(2013, 7, 13, 3, 8, 24, 880386),
            tags={
                'server': 'example.com',
                'environment': 'production',
            }
        )
        self.event3 = self.create_event(
            event_id='c' * 32,
            group=self.group1,
            datetime=datetime(2013, 8, 13, 3, 8, 24, 880386),
            tags={
                'server': 'example.com',
                'environment': 'production',
            }
        )

        self.group2 = self.create_group(
            project=self.project,
            checksum='b' * 32,
            message='bar',
            times_seen=10,
            status=GroupStatus.RESOLVED,
            last_seen=datetime(2013, 7, 14, 3, 8, 24, 880386),
            first_seen=datetime(2013, 7, 14, 3, 8, 24, 880386),
            score=ScoreClause.calculate(
                times_seen=10,
                last_seen=datetime(2013, 7, 14, 3, 8, 24, 880386),
            ),
        )

        self.event2 = self.create_event(
            event_id='b' * 32,
            group=self.group2,
            datetime=datetime(2013, 7, 14, 3, 8, 24, 880386),
            tags={
                'server': 'example.com',
                'environment': 'staging',
                'url': 'http://example.com',
            }
        )

        for key, value in self.event1.data['tags']:
            tagstore.create_group_tag_value(
                project_id=self.group1.project_id,
                group_id=self.group1.id,
                environment_id=None,
                key=key,
                value=value,
            )
        for key, value in self.event2.data['tags']:
            tagstore.create_group_tag_value(
                project_id=self.group2.project_id,
                group_id=self.group2.id,
                environment_id=None,
                key=key,
                value=value,
            )

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

        tenants.set_current_tenant(tenants.UnrestrictedTenant)

    def test_query(self):
        results = self.backend.query(self.project, query='foo')
        assert set(results) == set([self.group1])

        results = self.backend.query(self.project, query='bar')
        assert set(results) == set([self.group2])

    def test_sort(self):
        results = self.backend.query(self.project, sort_by='date')
        assert list(results) == [self.group1, self.group2]

        results = self.backend.query(self.project, sort_by='new')
        assert list(results) == [self.group2, self.group1]

        results = self.backend.query(self.project, sort_by='freq')
        assert list(results) == [self.group2, self.group1]

        results = self.backend.query(self.project, sort_by='priority')
        assert list(results) == [self.group1, self.group2]

    def test_status(self):
        results = self.backend.query(self.project, status=GroupStatus.UNRESOLVED)
        assert set(results) == set([self.group1])

        results = self.backend.query(self.project, status=GroupStatus.RESOLVED)
        assert set(results) == set([self.group2])

    def test_tags(self):
        results = self.backend.query(
            self.project,
            tags={'environment': 'staging'})
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            tags={'environment': 'example.com'})
        assert set(results) == set([])

        results = self.backend.query(
            self.project,
            tags={'environment': ANY})
        assert set(results) == set([self.group2, self.group1])

        results = self.backend.query(
            self.project,
            tags={'environment': 'staging',
                  'server': 'example.com'})
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            tags={'environment': 'staging',
                  'server': ANY})
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            tags={'environment': 'staging',
                  'server': 'bar.example.com'})
        assert set(results) == set([])

    def test_bookmarked_by(self):
        results = self.backend.query(self.project, bookmarked_by=self.user)
        assert set(results) == set([self.group2])

    def test_project(self):
        results = self.backend.query(self.create_project(name='other'))
        assert set(results) == set([])

    def test_pagination(self):
        results = self.backend.query(self.project, limit=1, sort_by='date')
        assert set(results) == set([self.group1])

        results = self.backend.query(self.project, cursor=results.next, limit=1, sort_by='date')
        assert set(results) == set([self.group2])

        results = self.backend.query(self.project, cursor=results.next, limit=1, sort_by='date')
        assert set(results) == set([])

    def test_age_filter(self):
        results = self.backend.query(
            self.project,
            age_from=self.group2.first_seen,
        )
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            age_to=self.group1.first_seen + timedelta(minutes=1),
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            age_from=self.group1.first_seen,
            age_to=self.group1.first_seen + timedelta(minutes=1),
        )
        assert set(results) == set([self.group1])

    def test_last_seen_filter(self):
        results = self.backend.query(
            self.project,
            last_seen_from=self.group1.last_seen,
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            last_seen_to=self.group2.last_seen + timedelta(minutes=1),
        )
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            last_seen_from=self.group1.last_seen,
            last_seen_to=self.group1.last_seen + timedelta(minutes=1),
        )
        assert set(results) == set([self.group1])

    def test_date_filter(self):
        results = self.backend.query(
            self.project,
            date_from=self.event2.datetime,
        )
        assert set(results) == set([self.group1, self.group2])

        results = self.backend.query(
            self.project,
            date_to=self.event1.datetime + timedelta(minutes=1),
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
        )
        assert set(results) == set([self.group1, self.group2])

    def test_unassigned(self):
        results = self.backend.query(self.project, unassigned=True)
        assert set(results) == set([self.group1])

        results = self.backend.query(self.project, unassigned=False)
        assert set(results) == set([self.group2])

    def test_assigned_to(self):
        results = self.backend.query(self.project, assigned_to=self.user)
        assert set(results) == set([self.group2])

        # test team assignee
        ga = GroupAssignee.objects.get(
            user=self.user,
            group=self.group2,
            project=self.group2.project,
        )
        ga.update(team=self.team, user=None)
        assert GroupAssignee.objects.get(id=ga.id).user is None

        results = self.backend.query(self.project, assigned_to=self.user)
        assert set(results) == set([self.group2])

        # test when there should be no results
        other_user = self.create_user()
        results = self.backend.query(self.project, assigned_to=other_user)
        assert set(results) == set([])

    def test_subscribed_by(self):
        results = self.backend.query(
            self.group1.project,
            subscribed_by=self.user,
        )
        assert set(results) == set([self.group1])
