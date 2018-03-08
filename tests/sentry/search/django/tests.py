# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytz
from datetime import datetime, timedelta

from sentry import tagstore
from sentry.models import (
    Environment, Event, GroupAssignee, GroupBookmark, GroupEnvironment, GroupStatus, GroupSubscription
)
from sentry.search.base import ANY
from sentry.search.django.backend import DjangoSearchBackend
from sentry.testutils import TestCase


class DjangoSearchBackendTest(TestCase):
    def create_backend(self):
        return DjangoSearchBackend()

    def setUp(self):
        self.backend = self.create_backend()

        self.group1 = self.create_group(
            checksum='a' * 32,
            message='foo',
            times_seen=5,
            status=GroupStatus.UNRESOLVED,
            last_seen=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=pytz.utc),
            first_seen=datetime(2013, 7, 13, 3, 8, 24, 880386, tzinfo=pytz.utc),
        )
        self.event1 = self.create_event(
            event_id='a' * 32,
            group=self.group1,
            datetime=datetime(2013, 7, 13, 3, 8, 24, 880386, tzinfo=pytz.utc),
            tags={
                'server': 'example.com',
                'environment': 'production',
            }
        )
        self.event3 = self.create_event(
            event_id='c' * 32,
            group=self.group1,
            datetime=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=pytz.utc),
            tags={
                'server': 'example.com',
                'environment': 'production',
            }
        )

        self.group2 = self.create_group(
            checksum='b' * 32,
            message='bar',
            times_seen=10,
            status=GroupStatus.RESOLVED,
            last_seen=datetime(2013, 7, 14, 3, 8, 24, 880386, tzinfo=pytz.utc),
            first_seen=datetime(2013, 7, 14, 3, 8, 24, 880386, tzinfo=pytz.utc),
        )
        self.event2 = self.create_event(
            event_id='b' * 32,
            group=self.group2,
            datetime=datetime(2013, 7, 14, 3, 8, 24, 880386, tzinfo=pytz.utc),
            tags={
                'server': 'example.com',
                'environment': 'staging',
                'url': 'http://example.com',
            }
        )

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
        tags = dict(event.data['tags'])

        try:
            environment = self.environments[tags['environment']]
        except KeyError:
            environment = self.environments[tags['environment']] = Environment.get_or_create(
                event.project,
                tags['environment'],
            )

        GroupEnvironment.objects.get_or_create(
            environment_id=environment.id,
            group_id=event.group_id,
        )

        for key, value in tags.items():
            value, created = tagstore.get_or_create_group_tag_value(
                project_id=event.project_id,
                group_id=event.group_id,
                environment_id=environment.id,
                key=key,
                value=value,
                defaults={
                    'first_seen': event.datetime,
                    'last_seen': event.datetime,
                },
            )

            if not created:
                updates = {
                    'times_seen': value.times_seen + 1,
                }

                if event.datetime < value.first_seen:
                    updates['first_seen'] = event.datetime

                if event.datetime > value.last_seen:
                    updates['last_seen'] = event.datetime

                if updates:
                    value.update(**updates)

    def test_query(self):
        results = self.backend.query(self.project, query='foo')
        assert list(results) == [self.group1]

        results = self.backend.query(self.project, query='bar')
        assert list(results) == [self.group2]

    def test_query_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            query='foo')
        assert list(results) == [self.group1]

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            query='bar')
        assert list(results) == []

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            query='bar')
        assert list(results) == [self.group2]

    def test_sort(self):
        results = self.backend.query(self.project, sort_by='date')
        assert list(results) == [self.group1, self.group2]

        results = self.backend.query(self.project, sort_by='new')
        assert list(results) == [self.group2, self.group1]

        results = self.backend.query(self.project, sort_by='freq')
        assert list(results) == [self.group2, self.group1]

    def test_sort_with_environment(self):
        raise NotImplementedError

    def test_status(self):
        results = self.backend.query(self.project, status=GroupStatus.UNRESOLVED)
        assert list(results) == [self.group1]

        results = self.backend.query(self.project, status=GroupStatus.RESOLVED)
        assert list(results) == [self.group2]

    def test_status_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            status=GroupStatus.UNRESOLVED)
        assert list(results) == [self.group1]

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            status=GroupStatus.RESOLVED)
        assert list(results) == [self.group2]

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            status=GroupStatus.RESOLVED)
        assert list(results) == []

    def test_tags(self):
        results = self.backend.query(
            self.project,
            tags={
                'environment': 'staging'})
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(self.project, tags={'environment': 'example.com'})
        assert len(results) == 0

        results = self.backend.query(self.project, tags={'environment': ANY})
        assert len(results) == 2

        results = self.backend.query(
            self.project, tags={'environment': 'staging',
                                'server': 'example.com'}
        )
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(self.project, tags={'environment': 'staging', 'server': ANY})
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(
            self.project, tags={'environment': 'staging',
                                'server': 'bar.example.com'}
        )
        assert len(results) == 0

    def test_tags_with_environment(self):
        raise NotImplementedError

    def test_bookmarked_by(self):
        results = self.backend.query(self.project, bookmarked_by=self.user)
        assert list(results) == [self.group2]

    def test_bookmarked_by_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            bookmarked_by=self.user)
        assert list(results) == [self.group2]

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            bookmarked_by=self.user)
        assert list(results) == []

    def test_project(self):
        results = self.backend.query(self.create_project(name='project2'))
        assert len(results) == 0

    def test_pagination(self):
        results = self.backend.query(self.project, limit=1, sort_by='date')
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(self.project, cursor=results.next, limit=1, sort_by='date')
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(self.project, cursor=results.next, limit=1, sort_by='date')
        assert len(results) == 0

    def test_pagination_with_environment(self):
        raise NotImplementedError

    def test_age_filter(self):
        results = self.backend.query(
            self.project,
            age_from=self.group2.first_seen,
            age_from_inclusive=True,
        )
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(
            self.project,
            age_to=self.group1.first_seen + timedelta(minutes=1),
            age_to_inclusive=True,
        )
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(
            self.project,
            age_from=self.group1.first_seen,
            age_from_inclusive=True,
            age_to=self.group1.first_seen + timedelta(minutes=1),
            age_to_inclusive=True,
        )
        assert len(results) == 1
        assert results[0] == self.group1

    def test_age_filter_with_environment(self):
        raise NotImplementedError

    def test_last_seen_filter(self):
        results = self.backend.query(
            self.project,
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=True,
        )
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(
            self.project,
            last_seen_to=self.group2.last_seen + timedelta(minutes=1),
            last_seen_to_inclusive=True,
        )
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(
            self.project,
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=True,
            last_seen_to=self.group1.last_seen + timedelta(minutes=1),
            last_seen_to_inclusive=True,
        )
        assert len(results) == 1
        assert results[0] == self.group1

    def test_last_seen_filter_with_environment(self):
        raise NotImplementedError

    def test_date_filter(self):
        results = self.backend.query(
            self.project,
            date_from=self.event2.datetime,
        )
        assert len(results) == 2
        assert results[0] == self.group1
        assert results[1] == self.group2

        results = self.backend.query(
            self.project,
            date_to=self.event1.datetime + timedelta(minutes=1),
        )
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(
            self.project,
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
        )
        assert len(results) == 2
        assert results[0] == self.group1
        assert results[1] == self.group2

    def test_date_filter_with_environment(self):
        raise NotImplementedError

    def test_unassigned(self):
        results = self.backend.query(self.project, unassigned=True)
        assert list(results) == [self.group1]

        results = self.backend.query(self.project, unassigned=False)
        assert list(results) == [self.group2]

    def test_unassigned_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            unassigned=True)
        assert list(results) == [self.group1]

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            unassigned=False)
        assert list(results) == [self.group2]

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            unassigned=False)
        assert list(results) == []

    def test_assigned_to(self):
        results = self.backend.query(self.project, assigned_to=self.user)
        assert list(results) == [self.group2]

    def test_assigned_to_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            assigned_to=self.user)
        assert list(results) == [self.group2]

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            assigned_to=self.user)
        assert list(results) == []

    def test_subscribed_by(self):
        results = self.backend.query(
            self.group1.project,
            subscribed_by=self.user,
        )
        assert list(results) == [self.group1]

    def test_subscribed_by_with_environment(self):
        results = self.backend.query(
            self.group1.project,
            environment=self.environments['production'],
            subscribed_by=self.user,
        )
        assert list(results) == [self.group1]

        results = self.backend.query(
            self.group1.project,
            environment=self.environments['staging'],
            subscribed_by=self.user,
        )
        assert list(results) == []
