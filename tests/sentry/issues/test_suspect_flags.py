import datetime
import time
import uuid
from typing import TypedDict

from sentry.issues.suspect_flags import (
    get_suspect_flag_scores,
    query_baseline_set,
    query_selection_set,
)
from sentry.testutils.cases import SnubaTestCase, TestCase


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
                "is_filtered": False,
            },
        ]
