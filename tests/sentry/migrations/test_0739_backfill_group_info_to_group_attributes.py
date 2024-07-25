import pytest
from django.conf import settings
from snuba_sdk.legacy import json_to_snql

from sentry.testutils.cases import SnubaTestCase, TestMigrations
from sentry.types.group import PriorityLevel
from sentry.utils import redis
from sentry.utils.snuba import raw_snql_query


def run_test(expected_groups):
    project = expected_groups[0].project
    json_body = {
        "selected_columns": [
            "group_id",
            "group_priority",
            "group_first_release",
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
    result = raw_snql_query(request)
    data = result["data"]

    assert {g.id for g in expected_groups} == {d["group_id"] for d in data}
    assert {g.priority for g in expected_groups} == {d["group_priority"] for d in data}
    assert {g.first_release.id if g.first_release else None for g in expected_groups} == {
        d["group_first_release"] for d in data
    }


class TestBackfillGroupAttributes(SnubaTestCase, TestMigrations):
    migrate_from = "0738_rm_reprocessing_step3"
    migrate_to = "0739_backfill_group_info_to_group_attributes"

    def setup_initial_state(self):
        self.group = self.create_group(priority=PriorityLevel.HIGH)
        self.group_2 = self.create_group(priority=PriorityLevel.LOW)
        release = self.create_release(project=self.group.project)

        self.group.update(first_release=release)

    @pytest.mark.skip(reason="old migration test")
    def test(self):
        run_test([self.group, self.group_2])


class TestBackfillGroupAttributesRetry(SnubaTestCase, TestMigrations):
    migrate_from = "0738_rm_reprocessing_step3"
    migrate_to = "0739_backfill_group_info_to_group_attributes"

    def setup_initial_state(self):
        self.group = self.create_group(priority=PriorityLevel.HIGH)
        self.group_2 = self.create_group(priority=PriorityLevel.LOW)
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        redis_client.set("backfill_group_info_to_group_attributes", self.group.id)

    @pytest.mark.skip(reason="old migration test")
    def test_restart(self):
        run_test([self.group_2])
