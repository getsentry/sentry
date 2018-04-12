from __future__ import absolute_import

import pytz
from datetime import datetime

from sentry.event_manager import ScoreClause
from sentry.models import (
    Environment, GroupAssignee, GroupBookmark, GroupStatus, GroupSubscription,
)
from sentry.search.django.backend import DjangoSearchBackend
from sentry.testutils import SnubaTestCase


class SnubaSearchTest(SnubaTestCase):
    def setUp(self):
        super(SnubaSearchTest, self).setUp()

        self.project.update_option('sentry:snuba', True)
        self.backend = DjangoSearchBackend()

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
