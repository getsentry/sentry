from django.conf import settings
from sentry_sdk import Hub
from snuba_sdk.legacy import json_to_snql

from sentry.testutils.cases import SnubaTestCase, TestMigrations
from sentry.utils import json, redis
from sentry.utils.snuba import _snuba_query


def run_test(expected_groups):
    project = expected_groups[0].project
    json_body = {
        "selected_columns": [
            "group_id",
        ],
        "offset": 0,
        "limit": 100,
        "project": [project.id],
        "dataset": "group_attributes",
        "order_by": ["group_id"],
        "consistent": True,
        "tenant_ids": {
            "referrer": "group_attributes",
            "organization_id": project.organization_id,
        },
    }
    request = json_to_snql(json_body, "group_attributes")
    request.validate()
    identity = lambda x: x
    resp = _snuba_query(((request, identity, identity), Hub(Hub.current), {}, "test_api"))[0]
    assert resp.status == 200
    data = json.loads(resp.data)["data"]
    assert {g.id for g in expected_groups} == {d["group_id"] for d in data}


class TestBackfillGroupAttributes(SnubaTestCase, TestMigrations):
    migrate_from = "0724_discover_saved_query_dataset"
    migrate_to = "0725_backfill_group_info_to_group_attributes"

    def setup_initial_state(self):
        self.group = self.create_group()
        self.group_2 = self.create_group()

    def test(self):
        run_test([self.group, self.group_2])


class TestBackfillGroupAttributesRetry(SnubaTestCase, TestMigrations):
    migrate_from = "0724_discover_saved_query_dataset"
    migrate_to = "0725_backfill_group_info_to_group_attributes"

    def setup_initial_state(self):
        self.group = self.create_group()
        self.group_2 = self.create_group()
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        redis_client.set("backfill_group_info_to_group_attributes", self.group.id)

    def test_restart(self):
        run_test([self.group_2])
