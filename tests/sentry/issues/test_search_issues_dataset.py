from datetime import datetime, timedelta

import sentry_sdk
from snuba_sdk.legacy import json_to_snql

from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils import json
from sentry.utils.snuba import _snuba_query


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
        identity = lambda x: x
        isolation_scope = sentry_sdk.Scope.get_isolation_scope().fork()
        current_scope = sentry_sdk.Scope.get_current_scope().fork()
        resp = _snuba_query(
            ((request, identity, identity), isolation_scope, current_scope, {}, "test_api")
        )
        assert resp[0].status == 200
        stuff = json.loads(resp[0].data)

        assert len(stuff["data"]) == 0
