from __future__ import absolute_import

from datetime import timedelta, datetime
from django.utils import timezone

from sentry.models import GroupSnooze, GroupStatus
from sentry.testutils import TestCase


class GroupTest(TestCase):
    def test_is_resolved(self):
        group = self.create_group(status=GroupStatus.RESOLVED)
        assert group.is_resolved()

        group.status = GroupStatus.MUTED
        assert not group.is_resolved()

        group.status = GroupStatus.UNRESOLVED
        assert not group.is_resolved()

        group.last_seen = timezone.now() - timedelta(hours=12)

        group.project.update_option('sentry:resolve_age', 24)

        assert not group.is_resolved()

        group.project.update_option('sentry:resolve_age', 1)

        assert group.is_resolved()

    def test_get_oldest_latest_event_no_events(self):
        group = self.create_group()
        assert group.get_latest_event() is None
        assert group.get_oldest_event() is None

    def test_get_oldest_latest_events(self):
        group = self.create_group()
        for i in xrange(0, 3):
            self.create_event(
                event_id=str(i),
                group=group,
                datetime=datetime(2013, 8, 13, 3, 8, i),
            )

        assert group.get_latest_event().event_id == '2'
        assert group.get_oldest_event().event_id == '0'

    def test_get_oldest_latest_identical_timestamps(self):
        group = self.create_group()
        for i in xrange(0, 3):
            self.create_event(
                event_id=str(i),
                group=group,
                datetime=datetime(2013, 8, 13, 3, 8, 50),
            )

        assert group.get_latest_event().event_id == '2'
        assert group.get_oldest_event().event_id == '0'

    def test_get_oldest_latest_almost_identical_timestamps(self):
        group = self.create_group()
        self.create_event(
            event_id='0',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 0),  # earliest
        )
        for i in xrange(1, 3):
            self.create_event(
                event_id=str(i),
                group=group,
                datetime=datetime(2013, 8, 13, 3, 8, 30),  # all in the middle
            )
        self.create_event(
            event_id='3',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 59),  # latest
        )

        assert group.get_latest_event().event_id == '3'
        assert group.get_oldest_event().event_id == '0'

    def test_is_muted_with_expired_snooze(self):
        group = self.create_group(
            status=GroupStatus.MUTED,
        )
        GroupSnooze.objects.create(
            group=group,
            until=timezone.now() - timedelta(minutes=1),
        )
        assert not group.is_muted()

    def test_status_with_expired_snooze(self):
        group = self.create_group(
            status=GroupStatus.MUTED,
        )
        GroupSnooze.objects.create(
            group=group,
            until=timezone.now() - timedelta(minutes=1),
        )
        assert group.get_status() is GroupStatus.UNRESOLVED
