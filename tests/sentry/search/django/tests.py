# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import datetime, timedelta

import pytest
import pytz
from django.conf import settings

from sentry import tagstore
from sentry.event_manager import ScoreClause
from sentry.models import (
    Environment, Event, GroupAssignee, GroupBookmark, GroupEnvironment, GroupStatus,
    GroupSubscription, Release, ReleaseEnvironment, ReleaseProjectEnvironment
)
from sentry.search.base import ANY
from sentry.search.django.backend import DjangoSearchBackend, get_latest_release
from sentry.tagstore.v2.backend import AGGREGATE_ENVIRONMENT_ID
from sentry.testutils import TestCase


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
            last_seen=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=pytz.utc),
            first_seen=datetime(2013, 7, 13, 3, 8, 24, 880386, tzinfo=pytz.utc),
            score=ScoreClause.calculate(
                times_seen=5,
                last_seen=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=pytz.utc),
            ),
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
            project=self.project,
            checksum='b' * 32,
            message='bar',
            times_seen=10,
            status=GroupStatus.RESOLVED,
            last_seen=datetime(2013, 7, 14, 3, 8, 24, 880386, tzinfo=pytz.utc),
            first_seen=datetime(2013, 7, 14, 3, 8, 24, 880386, tzinfo=pytz.utc),
            score=ScoreClause.calculate(
                times_seen=10,
                last_seen=datetime(2013, 7, 14, 3, 8, 24, 880386, tzinfo=pytz.utc),
            ),
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

    def test_query(self):
        results = self.backend.query(self.project, query='foo')
        assert set(results) == set([self.group1])

        results = self.backend.query(self.project, query='bar')
        assert set(results) == set([self.group2])

    def test_query_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            query='foo')
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            query='bar')
        assert set(results) == set([])

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            query='bar')
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

    def test_sort_with_environment(self):
        for dt in [
                self.group1.first_seen + timedelta(days=1),
                self.group1.first_seen + timedelta(days=2),
                self.group1.last_seen + timedelta(days=1)]:
            event = self.create_event(
                group=self.group2,
                datetime=dt,
                tags={'environment': 'production'}
            )
            self._setup_tags_for_event(event)

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            sort_by='date',
        )
        assert list(results) == [self.group2, self.group1]

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            sort_by='new',
        )
        assert list(results) == [self.group2, self.group1]

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            sort_by='freq',
        )
        assert list(results) == [self.group2, self.group1]

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            sort_by='priority',
        )
        assert list(results) == [self.group2, self.group1]

    def test_status(self):
        results = self.backend.query(self.project, status=GroupStatus.UNRESOLVED)
        assert set(results) == set([self.group1])

        results = self.backend.query(self.project, status=GroupStatus.RESOLVED)
        assert set(results) == set([self.group2])

    def test_status_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            status=GroupStatus.UNRESOLVED)
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            status=GroupStatus.RESOLVED)
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            status=GroupStatus.RESOLVED)
        assert set(results) == set([])

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

    def test_tags_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            tags={'server': 'example.com'})
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            tags={'server': 'example.com'})
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            tags={'server': ANY})
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            tags={
                'environment': ANY,
                'server': ANY,
            })
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            tags={'url': 'http://example.com'})
        assert set(results) == set([])

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            tags={'url': 'http://example.com'})
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            tags={'server': 'bar.example.com'})
        assert set(results) == set([])

    def test_bookmarked_by(self):
        results = self.backend.query(self.project, bookmarked_by=self.user)
        assert set(results) == set([self.group2])

    def test_bookmarked_by_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            bookmarked_by=self.user)
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            bookmarked_by=self.user)
        assert set(results) == set([])

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

    def test_pagination_with_environment(self):
        for dt in [
                self.group1.first_seen + timedelta(days=1),
                self.group1.first_seen + timedelta(days=2),
                self.group1.last_seen + timedelta(days=1)]:
            event = self.create_event(
                group=self.group2,
                datetime=dt,
                tags={'environment': 'production'}
            )
            self._setup_tags_for_event(event)

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            sort_by='date',
            limit=1,
            count_hits=True,
        )
        assert list(results) == [self.group2]
        assert results.hits == 2

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            sort_by='date',
            limit=1,
            cursor=results.next,
            count_hits=True,
        )
        assert list(results) == [self.group1]
        assert results.hits == 2

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            sort_by='date',
            limit=1,
            cursor=results.next,
            count_hits=True,
        )
        assert list(results) == []
        assert results.hits == 2

    def test_age_filter(self):
        results = self.backend.query(
            self.project,
            age_from=self.group2.first_seen,
            age_from_inclusive=True,
        )
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            age_to=self.group1.first_seen + timedelta(minutes=1),
            age_to_inclusive=True,
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            age_from=self.group1.first_seen,
            age_from_inclusive=True,
            age_to=self.group1.first_seen + timedelta(minutes=1),
            age_to_inclusive=True,
        )
        assert set(results) == set([self.group1])

    def test_age_filter_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            age_from=self.group1.first_seen,
            age_from_inclusive=True,
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            age_to=self.group1.first_seen,
            age_to_inclusive=True,
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            age_from=self.group1.first_seen,
            age_from_inclusive=False,
        )
        assert set(results) == set([])

        event = self.create_event(
            group=self.group1,
            datetime=self.group1.first_seen + timedelta(days=1),
            tags={
                'environment': 'development',
            }
        )

        self._setup_tags_for_event(event)

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            age_from=self.group1.first_seen,
            age_from_inclusive=False,
        )
        assert set(results) == set([])

        results = self.backend.query(
            self.project,
            environment=self.environments['development'],
            age_from=self.group1.first_seen,
            age_from_inclusive=False,
        )
        assert set(results) == set([self.group1])

    def test_last_seen_filter(self):
        results = self.backend.query(
            self.project,
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=True,
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            last_seen_to=self.group2.last_seen + timedelta(minutes=1),
            last_seen_to_inclusive=True,
        )
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=True,
            last_seen_to=self.group1.last_seen + timedelta(minutes=1),
            last_seen_to_inclusive=True,
        )
        assert set(results) == set([self.group1])

    def test_last_seen_filter_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=True,
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            last_seen_to=self.group1.last_seen,
            last_seen_to_inclusive=True,
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=False,
        )
        assert set(results) == set([])

        event = self.create_event(
            group=self.group1,
            datetime=self.group1.last_seen + timedelta(days=1),
            tags={
                'environment': 'development',
            }
        )

        self._setup_tags_for_event(event)

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=False,
        )
        assert set(results) == set([])

        results = self.backend.query(
            self.project,
            environment=self.environments['development'],
            last_seen_from=self.group1.last_seen,
            last_seen_from_inclusive=False,
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

    @pytest.mark.xfail(
        not settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.v2'),
        reason='unsupported on legacy backend due to insufficient index',
    )
    def test_date_filter_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            date_from=self.event2.datetime,
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            date_to=self.event1.datetime + timedelta(minutes=1),
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
        )
        assert set(results) == set([self.group2])

    def test_unassigned(self):
        results = self.backend.query(self.project, unassigned=True)
        assert set(results) == set([self.group1])

        results = self.backend.query(self.project, unassigned=False)
        assert set(results) == set([self.group2])

    def test_unassigned_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            unassigned=True)
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            unassigned=False)
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            unassigned=False)
        assert set(results) == set([])

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

        owner = self.create_user()
        self.create_member(
            organization=self.project.organization,
            user=owner,
            role='owner',
            teams=[],
        )

        # test that owners don't see results for all teams
        results = self.backend.query(self.project, assigned_to=owner)
        assert set(results) == set([])

    def test_assigned_to_with_environment(self):
        results = self.backend.query(
            self.project,
            environment=self.environments['staging'],
            assigned_to=self.user)
        assert set(results) == set([self.group2])

        results = self.backend.query(
            self.project,
            environment=self.environments['production'],
            assigned_to=self.user)
        assert set(results) == set([])

    def test_subscribed_by(self):
        results = self.backend.query(
            self.group1.project,
            subscribed_by=self.user,
        )
        assert set(results) == set([self.group1])

    def test_subscribed_by_with_environment(self):
        results = self.backend.query(
            self.group1.project,
            environment=self.environments['production'],
            subscribed_by=self.user,
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.group1.project,
            environment=self.environments['staging'],
            subscribed_by=self.user,
        )
        assert set(results) == set([])

    def test_parse_release_latest(self):
        with pytest.raises(Release.DoesNotExist):
            # no releases exist period
            environment = None
            result = get_latest_release(self.project, environment)

        old = Release.objects.create(
            organization_id=self.project.organization_id,
            version='old'
        )
        old.add_project(self.project)

        new_date = old.date_added + timedelta(minutes=1)
        new = Release.objects.create(
            version='new-but-in-environment',
            organization_id=self.project.organization_id,
            date_released=new_date,
        )
        new.add_project(self.project)
        ReleaseEnvironment.get_or_create(
            project=self.project,
            release=new,
            environment=self.environment,
            datetime=new_date,
        )
        ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=new,
            environment=self.environment,
            datetime=new_date,
        )

        newest = Release.objects.create(
            version='newest-overall',
            organization_id=self.project.organization_id,
            date_released=old.date_added + timedelta(minutes=5),
        )
        newest.add_project(self.project)

        # latest overall (no environment filter)
        environment = None
        result = get_latest_release(self.project, environment)
        assert result == newest.version

        # latest in environment
        environment = self.environment
        result = get_latest_release(self.project, environment)
        assert result == new.version

        with pytest.raises(Release.DoesNotExist):
            # environment with no releases
            environment = self.create_environment()
            result = get_latest_release(self.project, environment)
            assert result == new.version
