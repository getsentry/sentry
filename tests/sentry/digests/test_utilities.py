from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.digests.utilities import get_notifications_from_digest
from sentry.digests.notifications import (
    build_digest,
    event_to_record,
)
from sentry.testutils import TestCase


class SortWholeRecordsTestCase(TestCase):
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

    def sort_notifications_by_event_id(self, notifications):
        return sorted(notifications, key=lambda n: n.event.id)

    def test_get_notifications_from_digest(self):
        record1 = event_to_record(self.event_team, (self.rule,))
        record2 = event_to_record(self.event_all_users, (self.rule,))
        record3 = event_to_record(self.event_single_user, (self.rule,))

        records = (record2, record3, record1)
        digest = build_digest(self.project, records)

        notifications_1 = get_notifications_from_digest(digest)
        notifications_2 = self.sort_notifications_by_event_id([record.value for record in records])

        assert len(notifications_1) == len(notifications_2)
        for notification_1, notification_2 in zip(notifications_1, notifications_2):
            assert notification_1.event == notification_1.event
            assert sorted([rule.id for rule in notification_1.rules]) == notification_2.rules
