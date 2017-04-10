# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import datetime, timedelta

from sentry.models import (
    GroupAssignee, GroupBookmark, GroupStatus, GroupSubscription, GroupTagValue
)
from sentry.search.base import ANY
from sentry.search.django.backend import DjangoSearchBackend
from sentry.testutils import TestCase


class DjangoSearchBackendTest(TestCase):
    def create_backend(self):
        return DjangoSearchBackend()

    def setUp(self):
        self.backend = self.create_backend()

        self.project1 = self.create_project(name='foo')
        self.project2 = self.create_project(name='bar')

        self.group1 = self.create_group(
            project=self.project1,
            checksum='a' * 32,
            message='foo',
            times_seen=5,
            status=GroupStatus.UNRESOLVED,
            last_seen=datetime(2013, 8, 13, 3, 8, 24, 880386),
            first_seen=datetime(2013, 7, 13, 3, 8, 24, 880386),
        )
        self.event1 = self.create_event(
            event_id='a' * 32,
            group=self.group1,
            datetime=datetime(2013, 7, 13, 3, 8, 24, 880386),
            tags={
                'server': 'example.com',
                'env': 'production',
            }
        )
        self.event3 = self.create_event(
            event_id='c' * 32,
            group=self.group1,
            datetime=datetime(2013, 8, 13, 3, 8, 24, 880386),
            tags={
                'server': 'example.com',
                'env': 'production',
            }
        )

        self.group2 = self.create_group(
            project=self.project1,
            checksum='b' * 32,
            message='bar',
            times_seen=10,
            status=GroupStatus.RESOLVED,
            last_seen=datetime(2013, 7, 14, 3, 8, 24, 880386),
            first_seen=datetime(2013, 7, 14, 3, 8, 24, 880386),
        )
        self.event2 = self.create_event(
            event_id='b' * 32,
            group=self.group2,
            datetime=datetime(2013, 7, 14, 3, 8, 24, 880386),
            tags={
                'server': 'example.com',
                'env': 'staging',
                'url': 'http://example.com',
            }
        )

        for key, value in self.event1.data['tags']:
            GroupTagValue.objects.create(
                project=self.group1.project,
                group=self.group1,
                key=key,
                value=value,
            )
        for key, value in self.event2.data['tags']:
            GroupTagValue.objects.create(
                project=self.group2.project,
                group=self.group2,
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

    def test_query(self):
        results = self.backend.query(self.project1, query='foo')
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(self.project1, query='bar')
        assert len(results) == 1
        assert results[0] == self.group2

    def test_sort(self):
        results = self.backend.query(self.project1, sort_by='date')
        assert len(results) == 2
        assert results[0] == self.group1
        assert results[1] == self.group2

        results = self.backend.query(self.project1, sort_by='new')
        assert len(results) == 2
        assert results[0] == self.group2
        assert results[1] == self.group1

        results = self.backend.query(self.project1, sort_by='freq')
        assert len(results) == 2
        assert results[0] == self.group2
        assert results[1] == self.group1

    def test_status(self):
        results = self.backend.query(self.project1, status=GroupStatus.UNRESOLVED)
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(self.project1, status=GroupStatus.RESOLVED)
        assert len(results) == 1
        assert results[0] == self.group2

    def test_tags(self):
        results = self.backend.query(self.project1, tags={'env': 'staging'})
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(self.project1, tags={'env': 'example.com'})
        assert len(results) == 0

        results = self.backend.query(self.project1, tags={'env': ANY})
        assert len(results) == 2

        results = self.backend.query(self.project1, tags={'env': 'staging', 'server': 'example.com'})
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(self.project1, tags={'env': 'staging', 'server': ANY})
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(self.project1, tags={'env': 'staging', 'server': 'bar.example.com'})
        assert len(results) == 0

    def test_bookmarked_by(self):
        results = self.backend.query(self.project1, bookmarked_by=self.user)
        assert len(results) == 1
        assert results[0] == self.group2

    def test_project(self):
        results = self.backend.query(self.project2)
        assert len(results) == 0

    def test_pagination(self):
        results = self.backend.query(self.project1, limit=1, sort_by='date')
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(self.project1, cursor=results.next, limit=1, sort_by='date')
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(self.project1, cursor=results.next, limit=1, sort_by='date')
        assert len(results) == 0

    def test_age_filter(self):
        results = self.backend.query(
            self.project1,
            age_from=self.group2.first_seen,
        )
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(
            self.project1,
            age_to=self.group1.first_seen + timedelta(minutes=1),
        )
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(
            self.project1,
            age_from=self.group1.first_seen,
            age_to=self.group1.first_seen + timedelta(minutes=1),
        )
        assert len(results) == 1
        assert results[0] == self.group1

    def test_last_seen_filter(self):
        results = self.backend.query(
            self.project1,
            last_seen_from=self.group1.last_seen,
        )
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(
            self.project1,
            last_seen_to=self.group2.last_seen + timedelta(minutes=1),
        )
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(
            self.project1,
            last_seen_from=self.group1.last_seen,
            last_seen_to=self.group1.last_seen + timedelta(minutes=1),
        )
        assert len(results) == 1
        assert results[0] == self.group1

    def test_date_filter(self):
        results = self.backend.query(
            self.project1,
            date_from=self.event2.datetime,
        )
        assert len(results) == 2
        assert results[0] == self.group1
        assert results[1] == self.group2

        results = self.backend.query(
            self.project1,
            date_to=self.event1.datetime + timedelta(minutes=1),
        )
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(
            self.project1,
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
        )
        assert len(results) == 2
        assert results[0] == self.group1
        assert results[1] == self.group2

    def test_unassigned(self):
        results = self.backend.query(self.project1, unassigned=True)
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(self.project1, unassigned=False)
        assert len(results) == 1
        assert results[0] == self.group2

    def test_assigned_to(self):
        results = self.backend.query(self.project1, assigned_to=self.user)
        assert len(results) == 1
        assert results[0] == self.group2

    def test_subscribed_by(self):
        results = self.backend.query(
            self.group1.project,
            subscribed_by=self.user,
        )
        assert len(results) == 1
        assert results[0] == self.group1
