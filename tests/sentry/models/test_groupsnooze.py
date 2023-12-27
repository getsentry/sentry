import itertools
from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.models.group import Group
from sentry.models.groupsnooze import GroupSnooze
from sentry.testutils.cases import PerformanceIssueTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.performance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import SearchIssueTestMixin


@region_silo_test
class GroupSnoozeTest(
    TestCase,
    SnubaTestCase,
    PerfIssueTransactionTestMixin,
    SearchIssueTestMixin,
    PerformanceIssueTestCase,
):
    sequence = itertools.count()  # generates unique values, class scope doesn't matter

    def setUp(self):
        super().setUp()
        self.project = self.create_project()
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

    @freeze_time()
    def test_user_delta_reached(self):
        for i in range(5):
            self.store_event(
                data={
                    "user": {"id": i},
                    "timestamp": iso_format(before_now(seconds=1)),
                    "fingerprint": ["group1"],
                },
                project_id=self.project.id,
            )

        group = list(Group.objects.all())[-1]
        snooze = GroupSnooze.objects.create(group=group, user_count=5, state={"users_seen": 0})
        assert not snooze.is_valid(test_rates=True)

    @freeze_time()
    def test_user_rate_reached(self):
        """Test that ignoring an error issue until it's hit by 10 users in an hour works."""
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
    def test_user_rate_reached_perf_issues(self):
        """Test that ignoring a performance issue until it's hit by 10 users in an hour works."""
        for i in range(0, 10):
            event_data = load_data(
                "transaction-n-plus-one",
                timestamp=before_now(minutes=10),
            )
            event_data["user"]["id"] = str(i)
            event = self.create_performance_issue(event_data=event_data)
        perf_group = event.group
        snooze = GroupSnooze.objects.create(group=perf_group, user_count=10, user_window=60)
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
        """Test when an error issue is ignored until it happens 5 times in a day"""
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
    def test_rate_reached_perf_issue(self):
        """Test when a performance issue is ignored until it happens 10 times in a day"""
        for i in range(0, 10):
            event = self.create_performance_issue()
        snooze = GroupSnooze.objects.create(group=event.group, count=10, window=24 * 60)
        assert not snooze.is_valid(test_rates=True)

    @freeze_time()
    def test_rate_without_test(self):
        snooze = GroupSnooze.objects.create(group=self.group, count=100, window=60)
        assert snooze.is_valid(test_rates=False)

    @freeze_time()
    def test_user_rate_reached_generic_issues(self):
        """Test that ignoring a generic issue until it's hit by 10 users in an hour works."""
        for i in range(0, 10):
            event, occurrence, group_info = self.store_search_issue(
                project_id=self.project.id,
                user_id=i,
                fingerprints=["test_user_rate_reached_generic_issues-group"],
                environment=None,
            )
        assert group_info is not None
        generic_group = group_info.group
        assert generic_group is not None
        snooze = GroupSnooze.objects.create(group=generic_group, user_count=10, user_window=60)
        assert not snooze.is_valid(test_rates=True)

    @freeze_time()
    def test_rate_reached_generic_issue(self):
        """Test when a generic issue is ignored until it happens 10 times in a day"""
        for i in range(0, 10):
            event, occurrence, group_info = self.store_search_issue(
                project_id=self.project.id,
                user_id=3,  # pin the user_id here to verify the number of events impacts the snooze
                fingerprints=["test_rate_reached_generic_issue-group"],
                environment=None,
            )
        assert group_info is not None
        generic_group = group_info.group
        assert generic_group is not None
        snooze = GroupSnooze.objects.create(group=generic_group, count=10, window=24 * 60)
        assert not snooze.is_valid(test_rates=True)
