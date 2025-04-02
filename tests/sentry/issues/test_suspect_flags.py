import datetime
import time
import uuid

from sentry.issues.suspect_flags import get_suspect_flag_scores, query_flag_rows
from sentry.testutils.cases import SnubaTestCase, TestCase


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

        results = query_flag_rows(1, 1, before, later, group_id=None)
        assert results == [("key", "false", 1), ("key", "true", 1), ("other", "false", 2)]

    def test_get_suspect_flag_scores(self):
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

        results = get_suspect_flag_scores(1, 1, before, later, group_id=1)
        assert results == [("key", 2.7622287114272543), ("other", 0.0)]
