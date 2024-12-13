import itertools
from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone

import sentry.models.groupsnooze
from sentry.models.group import Group
from sentry.models.groupsnooze import GroupSnooze
from sentry.testutils.cases import PerformanceIssueTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import SearchIssueTestMixin


class GroupSnoozeTest(
    TestCase,
    SnubaTestCase,
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
                    "timestamp": before_now(seconds=1).isoformat(),
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
                    "timestamp": before_now(minutes=5 + i).isoformat(),
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
                    "timestamp": before_now(minutes=5 + i).isoformat(),
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

    def test_test_user_rates_w_cache(self):
        snooze = GroupSnooze.objects.create(group=self.group, user_count=100, user_window=60)

        cache_key = f"groupsnooze:v1:{snooze.id}:test_user_rate:events_seen_counter"

        with (
            mock.patch(
                "sentry.models.groupsnooze.tsdb.backend.get_distinct_counts_totals"
            ) as mocked_get_distinct_counts_totals,
            mock.patch.object(
                sentry.models.groupsnooze, "cache", wraps=sentry.models.groupsnooze.cache  # type: ignore[attr-defined]
            ) as cache_spy,
        ):
            mocked_get_distinct_counts_totals.side_effect = [
                {snooze.group_id: c} for c in [95, 98, 100]
            ]

            cache_spy.set = mock.Mock(side_effect=cache_spy.set)
            cache_spy.incr = mock.Mock(side_effect=cache_spy.incr)

            assert snooze.is_valid(test_rates=True)
            assert mocked_get_distinct_counts_totals.call_count == 1
            cache_spy.set.assert_called_with(cache_key, 95, 3600)

            assert snooze.is_valid(test_rates=True)
            assert mocked_get_distinct_counts_totals.call_count == 1
            cache_spy.incr.assert_called_with(cache_key)
            assert cache_spy.get(cache_key) == 96

            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 97
            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 98
            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 99

            # cache counter reaches 100, but gets 98 from get_distinct_counts_totals

            assert snooze.is_valid(test_rates=True)
            assert mocked_get_distinct_counts_totals.call_count == 2
            cache_spy.set.assert_called_with(cache_key, 98, 3600)
            assert cache_spy.get(cache_key) == 98

            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 99
            # with this call counter reaches 100, gets 100 from get_distinct_counts_totals, so is_valid returns False
            assert not snooze.is_valid(test_rates=True)
            assert mocked_get_distinct_counts_totals.call_count == 3

    def test_test_user_rates_w_cache_expired(self):
        snooze = GroupSnooze.objects.create(group=self.group, user_count=100, user_window=60)

        cache_key = f"groupsnooze:v1:{snooze.id}:test_user_rate:events_seen_counter"

        with (
            mock.patch(
                "sentry.models.groupsnooze.tsdb.backend.get_distinct_counts_totals"
            ) as mocked_get_distinct_counts_totals,
            mock.patch.object(
                sentry.models.groupsnooze, "cache", wraps=sentry.models.groupsnooze.cache  # type: ignore[attr-defined]
            ) as cache_spy,
        ):
            mocked_get_distinct_counts_totals.side_effect = [
                {snooze.group_id: c} for c in [98, 99, 100]
            ]

            cache_spy.set = mock.Mock(side_effect=cache_spy.set)
            cache_spy.incr = mock.Mock(side_effect=cache_spy.incr)

            assert snooze.is_valid(test_rates=True)
            assert mocked_get_distinct_counts_totals.call_count == 1
            cache_spy.set.assert_called_with(cache_key, 98, 3600)

            # simulate cache expiration
            cache_spy.delete(cache_key)

            assert snooze.is_valid(test_rates=True)
            assert mocked_get_distinct_counts_totals.call_count == 2
            cache_spy.set.assert_called_with(cache_key, 99, 3600)

            # simulate cache expiration
            cache_spy.delete(cache_key)

            assert not snooze.is_valid(test_rates=True)
            assert mocked_get_distinct_counts_totals.call_count == 3
            cache_spy.set.assert_called_with(cache_key, 100, 3600)

    def test_test_user_count_w_cache(self):
        snooze = GroupSnooze.objects.create(group=self.group, user_count=100)

        cache_key = f"groupsnooze:v1:{snooze.id}:test_user_counts:events_seen_counter"

        with (
            mock.patch.object(
                snooze.group,
                "count_users_seen",
                side_effect=[95, 98, 100],
            ) as mocked_count_users_seen,
            mock.patch.object(
                sentry.models.groupsnooze, "cache", wraps=sentry.models.groupsnooze.cache  # type: ignore[attr-defined]
            ) as cache_spy,
        ):

            cache_spy.set = mock.Mock(side_effect=cache_spy.set)
            cache_spy.incr = mock.Mock(side_effect=cache_spy.incr)

            assert snooze.is_valid(test_rates=True)
            assert mocked_count_users_seen.call_count == 1
            cache_spy.set.assert_called_with(cache_key, 95, 3600)

            assert snooze.is_valid(test_rates=True)
            assert mocked_count_users_seen.call_count == 1
            cache_spy.incr.assert_called_with(cache_key)
            assert cache_spy.get(cache_key) == 96

            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 97
            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 98
            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 99

            # cache counter reaches 100, but gets 98 from count_users_seen

            assert snooze.is_valid(test_rates=True)
            assert mocked_count_users_seen.call_count == 2
            cache_spy.set.assert_called_with(cache_key, 98, 3600)
            assert cache_spy.get(cache_key) == 98

            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 99
            # with this call counter reaches 100, gets 100 from count_users_seen, so is_valid returns False
            assert not snooze.is_valid(test_rates=True)
            assert mocked_count_users_seen.call_count == 3

    def test_test_user_count_w_cache_expired(self):
        snooze = GroupSnooze.objects.create(group=self.group, user_count=100)

        cache_key = f"groupsnooze:v1:{snooze.id}:test_user_counts:events_seen_counter"

        with (
            mock.patch.object(
                snooze.group,
                "count_users_seen",
                side_effect=[98, 99, 100],
            ) as mocked_count_users_seen,
            mock.patch.object(
                sentry.models.groupsnooze, "cache", wraps=sentry.models.groupsnooze.cache  # type: ignore[attr-defined]
            ) as cache_spy,
        ):
            cache_spy.set = mock.Mock(side_effect=cache_spy.set)
            cache_spy.incr = mock.Mock(side_effect=cache_spy.incr)

            assert snooze.is_valid(test_rates=True)
            assert mocked_count_users_seen.call_count == 1
            cache_spy.set.assert_called_with(cache_key, 98, 3600)

            # simulate cache expiration
            cache_spy.delete(cache_key)

            assert snooze.is_valid(test_rates=True)
            assert mocked_count_users_seen.call_count == 2
            cache_spy.set.assert_called_with(cache_key, 99, 3600)

            # simulate cache expiration
            cache_spy.delete(cache_key)

            assert not snooze.is_valid(test_rates=True)
            assert mocked_count_users_seen.call_count == 3
            cache_spy.set.assert_called_with(cache_key, 100, 3600)

    def test_test_frequency_rates_w_cache(self):
        snooze = GroupSnooze.objects.create(group=self.group, count=100, window=60)

        cache_key = f"groupsnooze:v1:{snooze.id}:test_frequency_rate:events_seen_counter"

        with (
            mock.patch("sentry.models.groupsnooze.tsdb.backend.get_sums") as mocked_get_sums,
            mock.patch.object(
                sentry.models.groupsnooze, "cache", wraps=sentry.models.groupsnooze.cache  # type: ignore[attr-defined]
            ) as cache_spy,
        ):
            mocked_get_sums.side_effect = [{snooze.group_id: c} for c in [95, 98, 100]]

            cache_spy.set = mock.Mock(side_effect=cache_spy.set)
            cache_spy.incr = mock.Mock(side_effect=cache_spy.incr)

            assert snooze.is_valid(test_rates=True)
            assert mocked_get_sums.call_count == 1
            cache_spy.set.assert_called_with(cache_key, 95, 3600)

            assert snooze.is_valid(test_rates=True)
            assert mocked_get_sums.call_count == 1
            cache_spy.incr.assert_called_with(cache_key)
            assert cache_spy.get(cache_key) == 96

            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 97
            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 98
            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 99

            # cache counter reaches 100, but gets 98 from get_distinct_counts_totals

            assert snooze.is_valid(test_rates=True)
            assert mocked_get_sums.call_count == 2
            cache_spy.set.assert_called_with(cache_key, 98, 3600)
            assert cache_spy.get(cache_key) == 98

            assert snooze.is_valid(test_rates=True)
            assert cache_spy.get(cache_key) == 99
            # with this call counter reaches 100, gets 100 from get_distinct_counts_totals, so is_valid returns False
            assert not snooze.is_valid(test_rates=True)
            assert mocked_get_sums.call_count == 3

    def test_test_frequency_rates_w_cache_expired(self):
        snooze = GroupSnooze.objects.create(group=self.group, count=100, window=60)

        cache_key = f"groupsnooze:v1:{snooze.id}:test_frequency_rate:events_seen_counter"

        with (
            mock.patch("sentry.models.groupsnooze.tsdb.backend.get_sums") as mocked_get_sums,
            mock.patch.object(
                sentry.models.groupsnooze, "cache", wraps=sentry.models.groupsnooze.cache  # type: ignore[attr-defined]
            ) as cache_spy,
        ):
            mocked_get_sums.side_effect = [{snooze.group_id: c} for c in [98, 99, 100]]

            cache_spy.set = mock.Mock(side_effect=cache_spy.set)
            cache_spy.incr = mock.Mock(side_effect=cache_spy.incr)

            assert snooze.is_valid(test_rates=True)
            assert mocked_get_sums.call_count == 1
            cache_spy.set.assert_called_with(cache_key, 98, 3600)

            # simulate cache expiration
            cache_spy.delete(cache_key)

            assert snooze.is_valid(test_rates=True)
            assert mocked_get_sums.call_count == 2
            cache_spy.set.assert_called_with(cache_key, 99, 3600)

            # simulate cache expiration
            cache_spy.delete(cache_key)

            assert not snooze.is_valid(test_rates=True)
            assert mocked_get_sums.call_count == 3
            cache_spy.set.assert_called_with(cache_key, 100, 3600)
