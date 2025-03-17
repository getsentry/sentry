from sentry_kafka_schemas.schema_types.group_attributes_v1 import GroupAttributesSnapshot
from snuba_sdk.legacy import json_to_snql

from sentry.issues.attributes import (
    _bulk_retrieve_group_values,
    _bulk_retrieve_snapshot_values,
    produce_snapshot_to_kafka,
)
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils.snuba import raw_snql_query


class DatasetTest(SnubaTestCase, TestCase):
    def _send(self, snapshot: GroupAttributesSnapshot) -> None:
        produce_snapshot_to_kafka(snapshot)

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
        result = raw_snql_query(request)
        assert len(result["data"]) == 0

    def test_insert_then_query(self) -> None:
        project = self.create_project()
        group = self.create_group(project=project)

        group_values = _bulk_retrieve_group_values([group.id])
        snapshot = _bulk_retrieve_snapshot_values(group_values, False)
        self._send(snapshot[0])

        json_body = {
            "selected_columns": ["project_id", "group_id"],
            "offset": 0,
            "limit": 100,
            "project": [project.id],
            "dataset": "group_attributes",
            "conditions": [
                ["project_id", "IN", [project.id]],
            ],
            "consistent": False,
            "tenant_ids": {
                "referrer": "group_attributes",
                "organization_id": project.organization.id,
            },
        }
        request = json_to_snql(json_body, "group_attributes")
        request.validate()
        result = raw_snql_query(request)
        assert len(result["data"]) == 1
