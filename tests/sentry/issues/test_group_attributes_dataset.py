from sentry_sdk import Hub
from snuba_sdk.legacy import json_to_snql

from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils import json
from sentry.utils.snuba import _snql_query


class DatasetTest(SnubaTestCase, TestCase):
    def test_query_dataset_returns_empty(self) -> None:
        json_body = {
            "selected_columns": ["project_id", "group_id"],
            "offset": 0,
            "limit": 100,
            "project": [1],
            "dataset": "group_attributes",
            "conditions": [
                ["project_id", "IN", [2]],
            ],
            "consistent": False,
            "tenant_ids": {"referrer": "group_attributes", "organization_id": 1},
        }
        request = json_to_snql(json_body, "group_attributes")
        request.validate()
        identity = lambda x: x
        resp = _snql_query(((request, identity, identity), Hub(Hub.current), {}, "test_api"))
        assert resp[0].status == 200
        stuff = json.loads(resp[0].data)

        assert len(stuff["data"]) == 0
