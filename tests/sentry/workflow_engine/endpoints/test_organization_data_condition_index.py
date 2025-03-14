from dataclasses import dataclass
from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DataConditionHandler


class OrganizationDataConditionAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-data-condition-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.registry = Registry[DataConditionHandler](enable_reverse_lookup=False)
        self.registry_patcher = patch(
            "sentry.workflow_engine.registry.condition_handler_registry",
            new=self.registry,
        )
        self.registry_patcher.__enter__()

        @self.registry.register(Condition.REAPPEARED_EVENT)
        @dataclass(frozen=True)
        class TestWorkflowTrigger(DataConditionHandler):
            type = DataConditionHandler.Type.WORKFLOW_TRIGGER
            comparison_json_schema = {"type": "boolean"}

        @self.registry.register(Condition.AGE_COMPARISON)
        @dataclass(frozen=True)
        class TestActionFilter(DataConditionHandler):
            type = DataConditionHandler.Type.ACTION_FILTER
            filter_group = DataConditionHandler.FilterGroup.ISSUE_ATTRIBUTES
            comparison_json_schema = {
                "type": "object",
                "properties": {
                    "value": {"type": "integer", "minimum": 0},
                },
                "required": ["value"],
                "additionalProperties": False,
            }

    def tearDown(self) -> None:
        super().tearDown()
        self.registry_patcher.__exit__(None, None, None)


@region_silo_test
class OrganizationDataCondiitonIndexBaseTest(OrganizationDataConditionAPITestCase):
    def test_simple(self):
        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 2

    def test_type_filter(self):
        response = self.get_success_response(
            self.organization.slug, type=DataConditionHandler.Type.WORKFLOW_TRIGGER
        )
        assert len(response.data) == 1
        assert response.data[0] == {
            "condition_id": Condition.REAPPEARED_EVENT.value,
            "type": DataConditionHandler.Type.WORKFLOW_TRIGGER.value,
            "comparison_json_schema": {"type": "boolean"},
        }

        response = self.get_success_response(
            self.organization.slug, type=DataConditionHandler.Type.ACTION_FILTER
        )
        assert len(response.data) == 1
        assert response.data[0] == {
            "condition_id": Condition.AGE_COMPARISON.value,
            "type": DataConditionHandler.Type.ACTION_FILTER.value,
            "filter_group": DataConditionHandler.FilterGroup.ISSUE_ATTRIBUTES.value,
            "comparison_json_schema": {
                "type": "object",
                "properties": {
                    "value": {"type": "integer", "minimum": 0},
                },
                "required": ["value"],
                "additionalProperties": False,
            },
        }

    def test_invalid_type(self):
        response = self.get_error_response(self.organization.slug, type="invalid")
        assert response.status_code == 400
