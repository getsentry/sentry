from datetime import datetime, timedelta

from snuba_sdk.legacy import json_to_snql

from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils.snuba import raw_snql_query


class DatasetTest(SnubaTestCase, TestCase):
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
            "tenant_ids": {"referrer": "search_issues", "organization_id": 1},
        }
        request = json_to_snql(json_body, "search_issues")
        request.validate()
        result = raw_snql_query(request)
        assert len(result["data"]) == 0
