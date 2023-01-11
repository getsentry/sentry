from datetime import datetime, timedelta

from sentry_sdk import Hub
from snuba_sdk.legacy import json_to_snql

from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils import json
from sentry.utils.snuba import _snql_query


class DatasetTest(SnubaTestCase, TestCase):  # type: ignore[misc]
    def test_query_dataset_returns_empty(self) -> None:
        # make a random query just to verify the table exists
        now = datetime.now()
        json_body = {
            "selected_columns": ["project_id"],
            "offset": 0,
            "limit": 100,
            "project": [1],
            "dataset": "search_issues",
            "groupby": ["project_id"],
            "conditions": [
                ["project_id", "IN", [2]],
                ["timestamp", ">=", now - timedelta(minutes=1)],
                ["timestamp", "<", now + timedelta(minutes=1)],
            ],
            "aggregations": [["count()", "", "count"]],
            "consistent": False,
        }
        request = json_to_snql(json_body, "search_issues")
        request.validate()
        resp = _snql_query(((request, None, None), Hub(Hub.current), {}, "test_api"))
        assert resp[0].status == 200
        stuff = json.loads(resp[0].data)

        assert len(stuff["data"]) == 0
