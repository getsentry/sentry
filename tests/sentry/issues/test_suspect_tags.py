import datetime
import time
import uuid

from sentry.issues.suspect_tags import (
    get_suspect_tag_scores,
    query_baseline_set,
    query_selection_set,
)
from sentry.testutils.cases import SnubaTestCase, TestCase


class SuspectTagsTest(TestCase, SnubaTestCase):
    def mock_event(self, ts, hash="a" * 32, group_id=None, project_id=1, tags=None):
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
                        "tags": list(tags.items()),
                    },
                },
                {},
            )
        )

    def test_query_baseline_set(self) -> None:
        before = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        today = before + datetime.timedelta(hours=1)
        later = today + datetime.timedelta(hours=1)

        self.mock_event(today, hash="a" * 32, tags={"key": True, "other": False})
        self.mock_event(today, hash="a" * 32, tags={"key": False, "other": False})

        results = query_baseline_set(
            1, 1, before, later, environments=[], tag_keys=["key", "other"]
        )
        assert results == [("key", "false", 1), ("key", "true", 1), ("other", "false", 2)]

    def test_query_selection_set(self) -> None:
        before = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        today = before + datetime.timedelta(hours=1)
        later = today + datetime.timedelta(hours=1)

        self.mock_event(today, hash="a" * 32, tags={"key": True, "other": False}, group_id=1)
        self.mock_event(today, hash="a" * 32, tags={"key": False, "other": False}, group_id=2)

        results = query_selection_set(1, 1, before, later, environments=[], group_id=1)
        assert results == [("key", "true", 1), ("other", "false", 1)]

    def test_get_suspect_tag_scores(self) -> None:
        before = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        today = before + datetime.timedelta(hours=1)
        later = today + datetime.timedelta(hours=1)

        self.mock_event(today, hash="a" * 32, tags={"key": True, "other": False}, group_id=1)
        self.mock_event(today, hash="a" * 32, tags={"key": False, "other": False}, group_id=2)

        results = get_suspect_tag_scores(1, 1, before, later, envs=[], group_id=1)
        assert results == [("key", 2.7622287114272543), ("other", 0.0)]
