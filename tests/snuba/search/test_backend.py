from __future__ import absolute_import


from datetime import datetime, timedelta

from sentry.event_manager import ScoreClause
from sentry.models import (
    Environment, GroupAssignee, GroupBookmark, GroupStatus, GroupSubscription,
)
from sentry.search.base import ANY
from sentry.search.snuba.backend import SnubaSearchBackend
from sentry.testutils import SnubaTestCase


class SnubaSearchTest(SnubaTestCase):
    def setUp(self):
        super(SnubaSearchTest, self).setUp()

        self.backend = SnubaSearchBackend()

        now = datetime.utcnow()
        self.group1 = self.create_group(
            project=self.project,
            checksum='a' * 32,
            message='foo',
            times_seen=5,
            status=GroupStatus.UNRESOLVED,
            last_seen=now - timedelta(hours=12),
            first_seen=now - timedelta(hours=24),
            score=ScoreClause.calculate(
                times_seen=5,
                last_seen=now - timedelta(hours=12),
            ),
        )

        self.event1 = self.create_event(
            event_id='a' * 32,
            group=self.group1,
            datetime=now - timedelta(hours=24),
            tags={
                'server': 'example.com',
                'environment': 'production',
            }
        )
        self.event3 = self.create_event(
            event_id='c' * 32,
            group=self.group1,
            datetime=now - timedelta(hours=12),
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
            last_seen=now - timedelta(hours=1),
            first_seen=now - timedelta(hours=1),
            score=ScoreClause.calculate(
                times_seen=10,
                last_seen=now - timedelta(hours=1),
            ),
        )

        self.event2 = self.create_event(
            event_id='b' * 32,
            group=self.group2,
            datetime=now - timedelta(hours=1),
            tags={
                'server': 'example.com',
                'environment': 'staging',
                'url': 'http://example.com',
            }
        )

        self.environment_prod = Environment.get_or_create(self.project, 'production')
        self.environment_staging = Environment.get_or_create(self.project, 'staging')

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

    def test(self):
        results = self.backend.query(
            self.project,
            environment=self.environment_prod,
            query='foo'
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            self.project,
            environment=self.environment_staging,
            query='bar'
        )
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
