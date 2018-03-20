
from __future__ import absolute_import
from sentry.testutils import TestCase
from sentry.digests.notifications import (
    event_to_record,
    build_digest,
)
from datetime import timedelta

from django.utils import timezone
from sentry.digests.utilities import sort_records, get_events_from_digest


class SortRecordsTestCase(TestCase):
    def setUp(self):
        self.group = self.create_group(
            first_seen=timezone.now() - timedelta(days=3),
            last_seen=timezone.now() - timedelta(hours=3),
            project=self.project,
            message='hello  world this is a group',
            logger='root',
        )
        self.group1 = self.create_group(
            project=self.project,
            first_seen=timezone.now() - timedelta(days=2),
            last_seen=timezone.now() - timedelta(hours=2),
            message='group 2',
            logger='root',
        )
        self.group2 = self.create_group(
            project=self.project,
            first_seen=timezone.now() - timedelta(days=1),
            last_seen=timezone.now() - timedelta(hours=1),
            message='group 3',
            logger='root',
        )
        self.event_single_user = self.create_event(
            group=self.group,
            message=self.group.message,
            datetime=self.group.last_seen,
            project=self.project,
        )
        self.event_all_users = self.create_event(
            group=self.group1,
            message=self.group1.message,
            datetime=self.group1.last_seen,
            project=self.project,
        )
        self.event_team = self.create_event(
            group=self.group2,
            message=self.group2.message,
            datetime=self.group2.last_seen,
            project=self.project,
        )

        self.rule = self.project.rule_set.all()[0]

    def test_sort_records_for_build_digest(self):
        record1 = event_to_record(self.event_team, (self.rule,))
        record2 = event_to_record(self.event_all_users, (self.rule,))
        record3 = event_to_record(self.event_single_user, (self.rule,))

        records = sort_records((record2, record3, record1))

        assert len(records) == 3
        assert records[0] == record1
        assert records[1] == record2
        assert records[2] == record3

    def test_get_events_from_digest(self):
        record1 = event_to_record(self.event_team, (self.rule,))
        record2 = event_to_record(self.event_all_users, (self.rule,))
        record3 = event_to_record(self.event_single_user, (self.rule,))

        records = sort_records((record2, record3, record1))
        digest = build_digest(self.project, records)
        events = sorted(get_events_from_digest(digest), key=lambda e_r: e_r[0].id)

        assert len(events) == 3
        assert events == [(self.event_single_user, [self.rule]),
                          (self.event_all_users, [self.rule]), (self.event_team, [self.rule])]
