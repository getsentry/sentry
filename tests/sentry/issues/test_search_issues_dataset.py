from datetime import datetime, timedelta

from sentry_sdk import Hub
from snuba_sdk.legacy import json_to_snql

from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils import json
from sentry.utils.snuba import _snql_query


class DatasetTest(SnubaTestCase, TestCase):
    def test_query_dataset_returns_empty(self):
        with self.settings(SENTRY_AUTORUN_SEARCH_ISSUES_MIGRATIONS=True):
            now = datetime.now()
            json_body = {
                "selected_columns": ["project_id"],
                "offset": 0,
                "limit": 100,
                "project": [1],
                "dataset": "search_issues",
                # "from_date": "2020-10-17T20:51:46.110774",
                # "to_date": "2021-01-15T20:51:47.110825",
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
            hub = Hub(Hub.current)
            headers = {}
            resp = _snql_query(((request, None, None), hub, headers))
            assert resp[0].status == 200
            stuff = json.loads(resp[0].data)

            assert len(stuff["data"]) == 0
