import itertools
from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from sentry.models import Group, GroupSnooze
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupSnoozeTest(TestCase, SnubaTestCase):
    sequence = itertools.count()  # generates unique values, class scope doesn't matter

    def setUp(self):
        super().setUp()
        self.group.times_seen_pending = 0

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

    def test_delta_reached_pending(self):
        snooze = GroupSnooze.objects.create(group=self.group, count=100, state={"times_seen": 0})
        self.group.update(times_seen=90)
        assert snooze.is_valid(use_pending_data=True)

        self.group.times_seen_pending = 10
        assert not snooze.is_valid(use_pending_data=True)

    def test_user_delta_not_reached(self):
        snooze = GroupSnooze.objects.create(
            group=self.group, user_count=100, state={"users_seen": 0}
        )
        assert snooze.is_valid(test_rates=True)

    def test_user_delta_reached(self):
        project = self.create_project()

        for i in range(0, 100):
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

    @freeze_time()
    def test_user_rate_reached(self):
        for i in range(5):
            group = self.store_event(
                data={
                    "fingerprint": ["group1"],
                    "timestamp": iso_format(before_now(minutes=5 + i)),
                    "tags": {"sentry:user": i},
                },
                project_id=self.project.id,
            ).group

        snooze = GroupSnooze.objects.create(group=group, user_count=5, user_window=60)
        assert not snooze.is_valid(test_rates=True)

    @freeze_time()
    def test_user_rate_not_reached(self):
        snooze = GroupSnooze.objects.create(group=self.group, user_count=100, user_window=60)
        assert snooze.is_valid(test_rates=True)

    @freeze_time()
    def test_user_rate_without_test(self):
        snooze = GroupSnooze.objects.create(group=self.group, count=100, window=60)
        assert snooze.is_valid(test_rates=False)

    @freeze_time()
    def test_rate_not_reached(self):
        snooze = GroupSnooze.objects.create(group=self.group, count=100, window=60)
        assert snooze.is_valid(test_rates=True)

    @freeze_time()
    def test_rate_reached(self):
        for i in range(5):
            group = self.store_event(
                data={
                    "fingerprint": ["group1"],
                    "timestamp": iso_format(before_now(minutes=5 + i)),
                },
                project_id=self.project.id,
            ).group
        snooze = GroupSnooze.objects.create(group=group, count=5, window=24 * 60)
        assert not snooze.is_valid(test_rates=True)

    @freeze_time()
    def test_rate_without_test(self):
        snooze = GroupSnooze.objects.create(group=self.group, count=100, window=60)
        assert snooze.is_valid(test_rates=False)
