from __future__ import absolute_import

import itertools
from sentry.utils.compat import mock
import pytest

from datetime import datetime, timedelta
from django.utils import timezone
from sentry import tsdb
from sentry.testutils import SnubaTestCase, TestCase
from sentry.models import Group, GroupSnooze
from six.moves import xrange
from sentry.testutils.helpers.datetime import iso_format, before_now


class GroupSnoozeTest(TestCase, SnubaTestCase):
    sequence = itertools.count()  # generates unique values, class scope doesn't matter

    def test_until_not_reached(self):
        snooze = GroupSnooze.objects.create(
            group=self.group, until=timezone.now() + timedelta(days=1)
        )
        assert snooze.is_valid()

    def test_until_reached(self):
        snooze = GroupSnooze.objects.create(
            group=self.group, until=timezone.now() - timedelta(days=1)
        )
        assert not snooze.is_valid()

    def test_mismatched_group(self):
        snooze = GroupSnooze.objects.create(group=self.group)
        with pytest.raises(ValueError):
            snooze.is_valid(self.create_group())

    def test_delta_not_reached(self):
        snooze = GroupSnooze.objects.create(group=self.group, count=100, state={"times_seen": 0})
        assert snooze.is_valid()

    def test_delta_reached(self):
        snooze = GroupSnooze.objects.create(group=self.group, count=100, state={"times_seen": 0})
        self.group.update(times_seen=100)
        assert not snooze.is_valid()

    def test_user_delta_not_reached(self):
        snooze = GroupSnooze.objects.create(
            group=self.group, user_count=100, state={"users_seen": 0}
        )
        assert snooze.is_valid(test_rates=True)

    def test_user_delta_reached(self):
        project = self.create_project()

        for i in xrange(0, 100):
            self.store_event(
                data={
                    "user": {"id": i},
                    "timestamp": iso_format(before_now(seconds=1)),
                    "fingerprint": ["group1"],
                },
                project_id=project.id,
            )

        group = list(Group.objects.all())[-1]
        snooze = GroupSnooze.objects.create(group=group, user_count=100, state={"users_seen": 0})
        assert not snooze.is_valid(test_rates=True)

    @mock.patch("django.utils.timezone.now")
    def test_user_rate_reached(self, mock_now):
        mock_now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

        snooze = GroupSnooze.objects.create(group=self.group, user_count=100, user_window=60)
        tsdb.record(
            tsdb.models.users_affected_by_group,
            self.group.id,
            [next(self.sequence) for _ in xrange(0, 101)],
        )
        assert not snooze.is_valid(test_rates=True)

    @mock.patch("django.utils.timezone.now")
    def test_user_rate_not_reached(self, mock_now):
        mock_now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

        snooze = GroupSnooze.objects.create(group=self.group, user_count=100, user_window=60)
        assert snooze.is_valid(test_rates=True)

    @mock.patch("django.utils.timezone.now")
    def test_user_rate_without_test(self, mock_now):
        mock_now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

        snooze = GroupSnooze.objects.create(group=self.group, count=100, window=60)
        assert snooze.is_valid(test_rates=False)

    @mock.patch("django.utils.timezone.now")
    def test_rate_not_reached(self, mock_now):
        mock_now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

        snooze = GroupSnooze.objects.create(group=self.group, count=100, window=60)
        assert snooze.is_valid(test_rates=True)

    @mock.patch("django.utils.timezone.now")
    def test_rate_reached(self, mock_now):
        mock_now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

        snooze = GroupSnooze.objects.create(group=self.group, count=100, window=24 * 60)
        for n in range(6):
            tsdb.incr(
                tsdb.models.group,
                self.group.id,
                count=20,
                timestamp=mock_now() - timedelta(minutes=n),
            )
        assert not snooze.is_valid(test_rates=True)

    @mock.patch("django.utils.timezone.now")
    def test_rate_without_test(self, mock_now):
        mock_now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

        snooze = GroupSnooze.objects.create(group=self.group, count=100, window=60)
        assert snooze.is_valid(test_rates=False)
