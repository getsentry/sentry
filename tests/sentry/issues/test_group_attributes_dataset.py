import requests
import urllib3
from django.conf import settings
from sentry_kafka_schemas import sentry_kafka_schemas
from sentry_kafka_schemas.schema_types.group_attributes_v1 import GroupAttributesSnapshot
from sentry_sdk import Hub
from snuba_sdk.legacy import json_to_snql

from sentry.issues.attributes import _retrieve_group_values, _retrieve_snapshot_values
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils import json, snuba
from sentry.utils.snuba import _snql_query


class DatasetTest(SnubaTestCase, TestCase):
    def _send(self, snapshot: GroupAttributesSnapshot) -> None:
        serialized_data = json.dumps(snapshot)
        codec = sentry_kafka_schemas.get_codec(topic=settings.KAFKA_GROUP_ATTRIBUTES)
        codec.decode(serialized_data.encode("utf-8"), validate=True)

        try:
            resp = requests.post(
                settings.SENTRY_SNUBA + "/tests/entities/group_attributes/insert",
                data=json.dumps([snapshot]),
            )

            if resp.status_code != 200:
                raise snuba.SnubaError(
                    f"HTTP {resp.status_code} response from Snuba! {json.loads(resp.text)}"
                )
            return None
        except urllib3.exceptions.HTTPError as err:
            raise snuba.SnubaError(err)

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

        snapshot = _retrieve_snapshot_values(_retrieve_group_values(group.id), False)
        self._send(snapshot)

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
        identity = lambda x: x
        resp = _snql_query(((request, identity, identity), Hub(Hub.current), {}, "test_api"))
        assert resp[0].status == 200
        stuff = json.loads(resp[0].data)

        assert len(stuff["data"]) == 1
