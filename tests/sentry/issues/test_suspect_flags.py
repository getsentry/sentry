import datetime
import math
import time
import uuid

from sentry.issues.suspect_flags import (
    as_attribute_dict,
    get_suspect_flag_scores,
    kl_score,
    query_flag_rows,
)
from sentry.testutils.cases import SnubaTestCase, TestCase


def test_as_attributes_dict():
    attrs = as_attribute_dict([("key", "true", 10), ("key", "false", 20), ("other", "true", 85)])
    assert attrs["key"]["true"] == 10
    assert attrs["key"]["false"] == 20
    assert attrs["other"]["true"] == 85
    assert "false" not in attrs["other"]


def test_kl_score():
    baseline = as_attribute_dict(
        [
            ("key", "true", 10),
            ("key", "false", 200),
            ("other", "true", 1000),
            ("other", "false", 5000),
        ]
    )
    outliers = as_attribute_dict(
        [
            ("key", "true", 10),
            ("other", "true", 100),
            ("other", "false", 500),
        ]
    )

    scores = kl_score(baseline, outliers)
    assert scores[0][0] == "key"
    assert math.isclose(scores[0][1], 8.58, rel_tol=1e-3)
    assert scores[1][0] == "other"
    assert math.isclose(scores[1][1], 0, abs_tol=1e-9)


class SnubaTest(TestCase, SnubaTestCase):
    def mock_event(self, ts, hash="a" * 32, group_id=None, project_id=1, flags=None):
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

    def test_query_flag_rows(self):
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

        results = query_flag_rows(1, 1, before, later, primary_hash=None)
        assert results == [("key", "false", 1), ("key", "true", 1), ("other", "false", 2)]

    def test_get_suspect_flag_scores(self):
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
            hash="b" * 32,
            flags=[
                {"flag": "key", "result": False},
                {"flag": "other", "result": False},
            ],
        )

        results = get_suspect_flag_scores(1, 1, before, later, primary_hash="a" * 32)
        assert results == [("key", 2.7622287114272543), ("other", 0.0)]
