import datetime
import time
import uuid
from typing import TypedDict

from sentry.issues.suspect_flags import (
    _query_error_counts_eap,
    _query_error_counts_snuba,
    get_suspect_flag_scores,
    query_baseline_set,
    query_selection_set,
)
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time


class _FlagResult(TypedDict):
    flag: str
    result: bool


class SnubaTest(TestCase, SnubaTestCase):
    def mock_event(
        self,
        ts: datetime.datetime,
        hash: str = "a" * 32,
        group_id: int | None = None,
        project_id: int = 1,
        flags: list[_FlagResult] | None = None,
    ) -> None:
        self.snuba_insert(
            (
                2,
                "insert",
                {
                    "event_id": uuid.uuid4().hex,
                    "primary_hash": hash,
                    "group_id": group_id if group_id else int(hash[:16], 16),
                    "project_id": project_id,
                    "message": "message",
                    "platform": "python",
                    "datetime": ts.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "data": {
                        "received": time.mktime(ts.timetuple()),
                        "contexts": {"flags": {"values": flags or []}},
                    },
                },
                {},
            )
        )

    def test_query_baseline_set(self) -> None:
        before = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        today = before + datetime.timedelta(hours=1)
        later = today + datetime.timedelta(hours=1)

        self.mock_event(
            today,
            hash="a" * 32,
            flags=[
                {"flag": "key", "result": True},
                {"flag": "other", "result": False},
            ],
        )
        self.mock_event(
            today,
            hash="a" * 32,
            flags=[
                {"flag": "key", "result": False},
                {"flag": "other", "result": False},
            ],
        )

        results = query_baseline_set(
            1, 1, before, later, environments=[], flag_keys=["key", "other"]
        )
        assert results == [("key", "false", 1), ("key", "true", 1), ("other", "false", 2)]

    def test_query_selection_set(self) -> None:
        before = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        today = before + datetime.timedelta(hours=1)
        later = today + datetime.timedelta(hours=1)

        self.mock_event(
            today,
            hash="a" * 32,
            group_id=1,
            flags=[
                {"flag": "key", "result": True},
                {"flag": "other", "result": False},
            ],
        )
        self.mock_event(
            today,
            hash="a" * 32,
            group_id=2,
            flags=[
                {"flag": "key", "result": False},
                {"flag": "other", "result": False},
            ],
        )

        results = query_selection_set(1, 1, before, later, environments=[], group_id=1)
        assert results == [("key", "true", 1), ("other", "false", 1)]

    def test_get_suspect_flag_scores(self) -> None:
        before = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        today = before + datetime.timedelta(hours=1)
        later = today + datetime.timedelta(hours=1)

        self.mock_event(
            today,
            group_id=1,
            flags=[
                {"flag": "key", "result": True},
                {"flag": "other", "result": False},
            ],
        )
        self.mock_event(
            today,
            group_id=2,
            flags=[
                {"flag": "key", "result": False},
                {"flag": "other", "result": False},
            ],
        )

        results = get_suspect_flag_scores(1, 1, before, later, envs=[], group_id=1)
        assert results == [
            {
                "flag": "key",
                "score": 0.01634056054997356,
                "baseline_percent": 0.5,
                "distribution": {
                    "baseline": {"false": 1, "true": 1},
                    "outliers": {"true": 1},
                },
                "is_filtered": True,
            },
            {
                "flag": "other",
                "score": 0.016181914331041776,
                "baseline_percent": 0,
                "distribution": {"baseline": {"false": 2}, "outliers": {"false": 1}},
                "is_filtered": True,
            },
        ]


class TestEAPQueryErrorCounts(TestCase, SnubaTestCase):
    FROZEN_TIME = datetime.datetime(2026, 2, 12, 6, 0, 0, tzinfo=datetime.UTC)

    def _query_both(self, group_id: int | None = None) -> tuple[int, int]:
        start = self.FROZEN_TIME - datetime.timedelta(hours=1)
        end = self.FROZEN_TIME + datetime.timedelta(hours=1)

        snuba_count = _query_error_counts_snuba(
            self.organization.id, self.project.id, start, end, [], group_id
        )
        eap_count = _query_error_counts_eap(
            self.organization.id, self.project.id, start, end, [], group_id
        )
        return snuba_count, eap_count

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_counts_match_with_group(self) -> None:
        events = self.store_events_to_snuba_and_eap(
            "flags-group-a", count=5, timestamp=self.FROZEN_TIME.timestamp()
        )
        group_id = events[0].group_id

        snuba_count, eap_count = self._query_both(group_id=group_id)

        assert snuba_count == eap_count == 5

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_counts_match_without_group(self) -> None:
        self.store_events_to_snuba_and_eap(
            "flags-no-group-a", count=3, timestamp=self.FROZEN_TIME.timestamp()
        )
        self.store_events_to_snuba_and_eap(
            "flags-no-group-b", count=4, timestamp=self.FROZEN_TIME.timestamp()
        )

        snuba_count, eap_count = self._query_both(group_id=None)

        assert snuba_count == eap_count == 7

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_counts_isolate_groups(self) -> None:
        group_a = self.store_events_to_snuba_and_eap(
            "flags-isolate-a", count=2, timestamp=self.FROZEN_TIME.timestamp()
        )[0].group_id
        group_b = self.store_events_to_snuba_and_eap(
            "flags-isolate-b", count=6, timestamp=self.FROZEN_TIME.timestamp()
        )[0].group_id

        snuba_a, eap_a = self._query_both(group_id=group_a)
        snuba_b, eap_b = self._query_both(group_id=group_b)

        assert snuba_a == eap_a == 2
        assert snuba_b == eap_b == 6
