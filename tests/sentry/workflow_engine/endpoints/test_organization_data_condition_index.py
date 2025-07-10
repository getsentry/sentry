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
        self.registry = Registry[type[DataConditionHandler]](enable_reverse_lookup=False)
        self.registry_patcher = patch(
            "sentry.workflow_engine.endpoints.organization_data_condition_index.condition_handler_registry",
            new=self.registry,
        )
        self.registry_patcher.start()

        @self.registry.register(Condition.REAPPEARED_EVENT)
        @dataclass(frozen=True)
        class TestWorkflowTrigger(DataConditionHandler):
            group = DataConditionHandler.Group.WORKFLOW_TRIGGER
            comparison_json_schema = {"type": "boolean"}

        @self.registry.register(Condition.AGE_COMPARISON)
        @dataclass(frozen=True)
        class TestActionFilter(DataConditionHandler):
            group = DataConditionHandler.Group.ACTION_FILTER
            subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES
            comparison_json_schema = {
                "type": "object",
                "properties": {
                    "value": {"type": "integer", "minimum": 0},
                },
                "required": ["value"],
                "additionalProperties": False,
            }

        @self.registry.register(Condition.ANOMALY_DETECTION)
        @dataclass(frozen=True)
        class TestDetectorTrigger(DataConditionHandler):
            group = DataConditionHandler.Group.DETECTOR_TRIGGER
            comparison_json_schema = {"type": "boolean"}

        # This legacy condition should not be included in the response
        @self.registry.register(Condition.EXISTING_HIGH_PRIORITY_ISSUE)
        @dataclass(frozen=True)
        class TestIgnoredCondition(DataConditionHandler):
            group = DataConditionHandler.Group.WORKFLOW_TRIGGER
            comparison_json_schema = {"type": "boolean"}

    def tearDown(self) -> None:
        super().tearDown()
        self.registry_patcher.stop()


@region_silo_test
class OrganizationDataConditionIndexBaseTest(OrganizationDataConditionAPITestCase):
    def test_group_filter(self):
        response = self.get_success_response(
            self.organization.slug,
            group=DataConditionHandler.Group.WORKFLOW_TRIGGER,
            status_code=200,
        )
        assert len(response.data) == 1
        assert response.data[0] == {
            "type": Condition.REAPPEARED_EVENT.value,
            "handlerGroup": DataConditionHandler.Group.WORKFLOW_TRIGGER.value,
            "comparisonJsonSchema": {"type": "boolean"},
        }

        response = self.get_success_response(
            self.organization.slug, group=DataConditionHandler.Group.ACTION_FILTER, status_code=200
        )
        assert len(response.data) == 1
        assert response.data[0] == {
            "type": Condition.AGE_COMPARISON.value,
            "handlerGroup": DataConditionHandler.Group.ACTION_FILTER.value,
            "handlerSubgroup": DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES.value,
            "comparisonJsonSchema": {
                "type": "object",
                "properties": {
                    "value": {"type": "integer", "minimum": 0},
                },
                "required": ["value"],
                "additionalProperties": False,
            },
        }

    def test_invalid_group(self):
        self.get_error_response(self.organization.slug, group="invalid", status_code=400)

    def test_no_group(self):
        self.get_error_response(self.organization.slug, status_code=400)
