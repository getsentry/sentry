import functools
import itertools
import random
from datetime import datetime, timedelta
from typing import Optional, Sequence
from unittest import mock

import pytest
import pytz
from django.utils import timezone
from freezegun import freeze_time

from sentry.event_manager import _pull_out_data
from sentry.models import Group, GroupSnooze
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType


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
        for i in range(0, 100):
            self.store_event(
                data={
                    "user": {"id": i},
                    "timestamp": iso_format(before_now(seconds=1)),
                    "fingerprint": ["group1"],
                },
                project_id=self.project.id,
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
