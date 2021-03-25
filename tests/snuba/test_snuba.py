import copy
from unittest import mock
from datetime import datetime, timedelta

import pytest
import time
import uuid
from django.utils import timezone

from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils import snuba


class SnubaTest(TestCase, SnubaTestCase):
    def _insert_event_for_time(self, ts, hash="a" * 32, group_id=None):
        self.snuba_insert(
            (
                2,
                "insert",
                {
                    "event_id": uuid.uuid4().hex,
                    "primary_hash": hash,
                    "group_id": group_id if group_id else int(hash[:16], 16),
                    "project_id": self.project.id,
                    "message": "message",
                    "platform": "python",
                    "datetime": ts.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "data": {"received": time.mktime(ts.timetuple())},
                },
            )
        )

    def test(self):
        "This is just a simple 'hello, world' example test."

        now = datetime.now()

        events = [
            (
                2,
                "insert",
                {
                    "event_id": "a" * 32,
                    "primary_hash": "1" * 32,
                    "group_id": 1,
                    "project_id": self.project.id,
                    "message": "message",
                    "platform": "python",
                    "datetime": now.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "data": {"received": time.mktime(now.timetuple())},
                },
            )
        ]

        self.snuba_insert(events)

        assert (
            snuba.query(
                start=now - timedelta(days=1),
                end=now + timedelta(days=1),
                groupby=["project_id"],
                filter_keys={"project_id": [self.project.id]},
            )
            == {self.project.id: 1}
        )

    def test_fail(self):
        now = datetime.now()
        with pytest.raises(snuba.SnubaError):
            snuba.query(
                start=now - timedelta(days=1),
                end=now + timedelta(days=1),
                filter_keys={"project_id": [self.project.id]},
                groupby=[")("],
            )

    def test_organization_retention_respected(self):
        base_time = datetime.utcnow()

        self._insert_event_for_time(base_time - timedelta(minutes=1))
        self._insert_event_for_time(base_time - timedelta(days=2))

        def _get_event_count():
            # attempt to query back 90 days
            return snuba.query(
                start=base_time - timedelta(days=90),
                end=base_time + timedelta(days=1),
                groupby=["project_id"],
                filter_keys={"project_id": [self.project.id]},
            )

        assert _get_event_count() == {self.project.id: 2}
        with self.options({"system.event-retention-days": 1}):
            assert _get_event_count() == {self.project.id: 1}

    def test_organization_retention_larger_than_end_date(self):
        base_time = datetime.utcnow()

        with self.options({"system.event-retention-days": 1}):
            assert (
                snuba.query(
                    start=base_time - timedelta(days=90),
                    end=base_time - timedelta(days=60),
                    groupby=["project_id"],
                    filter_keys={"project_id": [self.project.id]},
                )
                == {}
            )


class BulkRawQueryTest(TestCase, SnubaTestCase):
    def test_simple(self):
        one_min_ago = iso_format(before_now(minutes=1))
        event_1 = self.store_event(
            data={"fingerprint": ["group-1"], "message": "hello", "timestamp": one_min_ago},
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={"fingerprint": ["group-2"], "message": "hello", "timestamp": one_min_ago},
            project_id=self.project.id,
        )

        results = snuba.bulk_raw_query(
            [
                snuba.SnubaQueryParams(
                    start=timezone.now() - timedelta(days=1),
                    end=timezone.now(),
                    selected_columns=["event_id", "group_id", "timestamp"],
                    filter_keys={"project_id": [self.project.id], "group_id": [event_1.group.id]},
                ),
                snuba.SnubaQueryParams(
                    start=timezone.now() - timedelta(days=1),
                    end=timezone.now(),
                    selected_columns=["event_id", "group_id", "timestamp"],
                    filter_keys={"project_id": [self.project.id], "group_id": [event_2.group.id]},
                ),
            ]
        )
        assert [{(item["group_id"], item["event_id"]) for item in r["data"]} for r in results] == [
            {(event_1.group.id, event_1.event_id)},
            {(event_2.group.id, event_2.event_id)},
        ]

    @mock.patch("sentry.utils.snuba._bulk_snuba_query", side_effect=snuba._bulk_snuba_query)
    def test_cache(self, _bulk_snuba_query):
        one_min_ago = iso_format(before_now(minutes=1))
        event_1 = self.store_event(
            data={"fingerprint": ["group-1"], "message": "hello", "timestamp": one_min_ago},
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={"fingerprint": ["group-2"], "message": "hello", "timestamp": one_min_ago},
            project_id=self.project.id,
        )
        params = [
            snuba.SnubaQueryParams(
                start=timezone.now() - timedelta(days=1),
                end=timezone.now(),
                selected_columns=["event_id", "group_id", "timestamp"],
                filter_keys={"project_id": [self.project.id], "group_id": [event_1.group.id]},
            ),
            snuba.SnubaQueryParams(
                start=timezone.now() - timedelta(days=1),
                end=timezone.now(),
                selected_columns=["event_id", "group_id", "timestamp"],
                filter_keys={"project_id": [self.project.id], "group_id": [event_2.group.id]},
            ),
        ]

        results = snuba.bulk_raw_query(
            copy.deepcopy(params),
            use_cache=True,
        )
        assert [{(item["group_id"], item["event_id"]) for item in r["data"]} for r in results] == [
            {(event_1.group.id, event_1.event_id)},
            {(event_2.group.id, event_2.event_id)},
        ]
        assert _bulk_snuba_query.call_count == 1
        _bulk_snuba_query.reset_mock()

        # # Make sure this doesn't appear in the cached results
        self.store_event(
            data={"fingerprint": ["group-2"], "message": "hello there", "timestamp": one_min_ago},
            project_id=self.project.id,
        )

        results = snuba.bulk_raw_query(
            copy.deepcopy(params),
            use_cache=True,
        )
        assert [{(item["group_id"], item["event_id"]) for item in r["data"]} for r in results] == [
            {(event_1.group.id, event_1.event_id)},
            {(event_2.group.id, event_2.event_id)},
        ]
        assert _bulk_snuba_query.call_count == 0
