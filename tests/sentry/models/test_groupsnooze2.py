import functools
import itertools
import random
from datetime import datetime, timedelta
from typing import Optional, Sequence
from unittest import mock

import pytest
import pytz
from django.utils import timezone

from sentry.event_manager import _pull_out_data
from sentry.models import Group, GroupSnooze
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType
from sentry.utils.samples import load_data
from sentry import tsdb



@region_silo_test
class GroupSnoozeTest(TestCase, SnubaTestCase):
    sequence = itertools.count()  # generates unique values, class scope doesn't matter

    def setUp(self):
        super().setUp()
        self.now = timezone.now()
        self.project = self.create_project()
        self.group.times_seen_pending = 0

    def __insert_transaction(
        self,
        environment: Optional[str],
        project_id: int,
        user_id: str,
        email: str,
        insert_timestamp: datetime,
        groups: Sequence[int],
        transaction_name: str,
    ):
        def inject_group_ids(jobs, projects, _groups=None):
            _pull_out_data(jobs, projects)
            if _groups:
                for job in jobs:
                    job["event"].groups = _groups
            return jobs, projects

        event_data = {
            "type": "transaction",
            "level": "info",
            "message": "transaction message",
            "tags": {
                "environment": environment,
                "sentry:user": f"id:{user_id}",
            },
            "user": {
                "id": user_id,
                "email": email,
            },
            "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            "timestamp": insert_timestamp.timestamp(),
            "start_timestamp": insert_timestamp.timestamp(),
            # "transaction": transaction_name,
            "transaction": "transaction: " + str(insert_timestamp) + str(random.randint(0, 1000)),
        }
        with mock.patch(
            "sentry.event_manager._pull_out_data",
            functools.partial(
                inject_group_ids,
                _groups=groups,
            ),
        ):
            event = self.store_event(
                data=event_data,
                project_id=project_id,
            )
            assert event

            from sentry.utils import snuba

            result = snuba.raw_query(
                dataset=snuba.Dataset.Transactions,
                start=insert_timestamp - timedelta(days=1),
                end=insert_timestamp + timedelta(days=1),
                selected_columns=[
                    "event_id",
                    "project_id",
                    "environment",
                    "group_ids",
                    "tags[sentry:user]",
                    "timestamp",
                ],
                groupby=None,
                filter_keys={"project_id": [project_id], "event_id": [event.event_id]},
            )
            assert len(result["data"]) == 1
            assert result["data"][0]["event_id"] == event.event_id
            assert result["data"][0]["project_id"] == event.project_id
            assert result["data"][0]["group_ids"] == [g.id for g in groups]
            assert result["data"][0]["tags[sentry:user]"] == f"id:{user_id}"
            assert result["data"][0]["environment"] == (environment if environment else None)
            assert result["data"][0]["timestamp"] == insert_timestamp.isoformat()

            return event

    @mock.patch("django.utils.timezone.now")
    def test_user_rate_reached(self, mock_now):
        """The initial way this test was implemented. This passes unless SnubaTSDB is used.
        Test that ignoring an issue until it's hit by 100 users in an hour works.
        """
        mock_now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

        snooze = GroupSnooze.objects.create(group=self.group, user_count=100, user_window=60)
        tsdb.record(
            tsdb.models.users_affected_by_group,
            self.group.id,
            [next(self.sequence) for _ in range(0, 101)],
        )
        assert not snooze.is_valid(test_rates=True)
        assert not snooze.is_valid(test_rates=True, use_snuba_tsdb=True)

    @mock.patch("django.utils.timezone.now")
    def test_user_rate_reached2(self, mock_now):
        """The newer way this test was implemented - by writing events. This passes using either tsdb version.
        Test that ignoring an issue until it's hit by 100 users in an hour works."""
        mock_now.return_value = self.now

        event = self.store_event(
            data={
                "user": {"id": 999},
                "timestamp": iso_format(before_now(minutes=2)),
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )
        snooze = GroupSnooze.objects.create(group=event.group, user_count=100, user_window=60)

        for i in range(0, 100):
            self.store_event(
                data={
                    "user": {"id": i},
                    "timestamp": iso_format(self.now - timedelta(minutes=1)),
                    "fingerprint": ["group1"],
                },
                project_id=self.project.id,
            )

        assert not snooze.is_valid(test_rates=True)
        assert not snooze.is_valid(test_rates=True, use_snuba_tsdb=True)

    @mock.patch("django.utils.timezone.now")
    def test_user_rate_reached_perf_issues(self, mock_now):
        """Using the original way the error issue test was written to try to test for perf issues.
           This doesn't pass using either tsdb. 
           Test that ignoring a performance issue until it's hit by 100 users in an hour works.
        """
        mock_now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)
        perf_group = self.create_group(
            type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES.value, project=self.project
        )

        snooze = GroupSnooze.objects.create(group=perf_group, user_count=100, user_window=60)
        tsdb.record(
            tsdb.models.users_affected_by_perf_group,
            self.group.id,
            [next(self.sequence) for _ in range(0, 101)],
        )
        assert not snooze.is_valid(test_rates=True)
        assert not snooze.is_valid(test_rates=True, use_snuba_tsdb=True)

    @mock.patch("django.utils.timezone.now")
    def test_user_rate_reached_perf_issues2(self, mock_now):
        """Write perf events. This passes only if SnubaTSDB is used.
        Test that ignoring a performance issue until it's hit by 100 users in an hour works.
        """
        now = (datetime.utcnow() - timedelta(days=1)).replace(
            hour=10, minute=0, second=0, microsecond=0, tzinfo=pytz.UTC
        )
        mock_now.return_value = now

        perf_group = self.create_group(
            type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES.value, project=self.project
        )
        snooze = GroupSnooze.objects.create(group=perf_group, user_count=3, user_window=60)

        times = 4

        for i in range(0, times):
            self.__insert_transaction(
                environment=None,
                project_id=self.project.id,
                user_id=str(i),
                email="test@email.com",
                insert_timestamp=now + timedelta(minutes=i * 10),
                groups=[perf_group],
                transaction_name=str(i),
            )

        assert not snooze.is_valid(test_rates=True, use_snuba_tsdb=True)
        assert not snooze.is_valid(test_rates=True)

    @mock.patch("django.utils.timezone.now")
    def test_rate_reached(self, mock_now):
        """The original implementation of this test. This passes unless SnubaTSDB is used.
        Test when an issue is ignored until it happens 100 times in a day.
        """
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
        assert not snooze.is_valid(test_rates=True, use_snuba_tsdb=True)

    @mock.patch("django.utils.timezone.now")
    def test_rate_reached2(self, mock_now):
        """The newer version of this test writes events instead of tsdb.incr. This passes using either tsdb version.
        Test when an issue is ignored until it happens 100 times in a day.
        """
        mock_now.return_value = self.now

        event = self.store_event(
            data={
                "user": {"id": 666},
                "timestamp": iso_format(before_now(minutes=2)),
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )
        snooze = GroupSnooze.objects.create(group=event.group, count=100, window=24 * 60)

        for i in range(0, 100):
            self.store_event(
                data={
                    "user": {"id": i},
                    "timestamp": iso_format(self.now - timedelta(minutes=1)),
                    "fingerprint": ["group1"],
                },
                project_id=self.project.id,
            )
        assert not snooze.is_valid(test_rates=True)
        assert not snooze.is_valid(test_rates=True, use_snuba_tsdb=True)

    @mock.patch("django.utils.timezone.now")
    def test_rate_reached_perf_issue(self, mock_now):
        """The performance issue version of the original implementation of this test.
        This doesn't pass using either tsdb. 
        Test when a performance issue is ignored until it happens 100 times in a day.
        """
        mock_now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

        perf_group = self.create_group(
            type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES.value, project=self.project
        )
        snooze = GroupSnooze.objects.create(group=perf_group, count=100, window=24 * 60)
        for n in range(6):
            tsdb.incr(
                tsdb.models.group_performance,
                self.group.id,
                count=20,
                timestamp=mock_now() - timedelta(minutes=n),
            )
        assert not snooze.is_valid(test_rates=True)
        assert not snooze.is_valid(test_rates=True, use_snuba_tsdb=True)

    @mock.patch("django.utils.timezone.now")
    def test_rate_reached_perf_issue2(self, mock_now):
        """Write perf events. This does not pass unless SnubaTSDB is used. 
        Test when a performance issue is ignored until it happens 6 times in a day.
        """
        now = (datetime.utcnow() - timedelta(days=1)).replace(
            hour=10, minute=0, second=0, microsecond=0, tzinfo=pytz.UTC
        )
        mock_now.return_value = now

        perf_group = self.create_group(
            type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES.value, project=self.project
        )
        snooze = GroupSnooze.objects.create(group=perf_group, count=6, window=24 * 60)

        times = 6 # this works up to 6 but fails after

        for i in range(0, times):
            self.__insert_transaction(
                environment=None,
                project_id=self.project.id,
                user_id=str(i),
                email="test@email.com",
                insert_timestamp=now + timedelta(minutes=i * 10),
                groups=[perf_group],
                transaction_name=str(i),
            )

        assert not snooze.is_valid(test_rates=True, use_snuba_tsdb=True)
        assert not snooze.is_valid(test_rates=True)

