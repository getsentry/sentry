from sentry_kafka_schemas.schema_types.group_attributes_v1 import GroupAttributesSnapshot
from sentry_sdk import Hub
from snuba_sdk.legacy import json_to_snql

from sentry.issues.attributes import produce_snapshot_to_kafka, send_snapshot_values
from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils import json
from sentry.utils.snuba import _snql_query


class DatasetTest(SnubaTestCase, TestCase):
    def produce_group_snapshot(self, snapshot: GroupAttributesSnapshot) -> None:
        produce_snapshot_to_kafka(snapshot)

    def lookup_and_produce_group_snapshot(self, group_id) -> None:
        with self.settings(SENTRY_SEND_GROUP_ATTRIBUTES_KAFKA=True):
            send_snapshot_values(group_id, None, False)

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

    def test_insert_then_query(self) -> None:
        project = self.create_project()
        group = self.create_group(project=project)
        self.lookup_and_produce_group_snapshot(group.id)

        json_body = {
            "selected_columns": ["project_id", "group_id"],
            "offset": 0,
            "limit": 100,
            "project": [1],
            "dataset": "group_attributes",
            "conditions": [
                ["project_id", "IN", [project.id]],
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

        assert len(stuff["data"]) == 1
