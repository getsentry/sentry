from unittest import mock

from rest_framework.exceptions import ErrorDetail

from sentry.api.serializers import serialize
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.models.environment import Environment
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    QuerySubscription,
    QuerySubscriptionDataSourceHandler,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.endpoints.validators.utils import get_unknown_detector_type_error
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DetectorPriorityLevel


class OrganizationProjectDetectorIndexBaseTest(APITestCase):
    endpoint = "sentry-api-0-organization-project-detector-index"
    method = "POST"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        # Access self.project eagerly to avoid lazy creation inside mock contexts
        _ = self.project
        self.environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )
        self.data_condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        self.connected_workflow = self.create_workflow(
            organization_id=self.organization.id,
        )
        self.valid_data = {
            "name": "Test Detector",
            "type": MetricIssue.slug,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.ERROR.value,
                    "dataset": Dataset.Events.name.lower(),
                    "query": "test query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                }
            ],
            "conditionGroup": {
                "id": self.data_condition_group.id,
                "organizationId": self.organization.id,
                "logicType": self.data_condition_group.logic_type,
                "conditions": [
                    {
                        "type": Condition.GREATER,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.HIGH,
                        "conditionGroupId": self.data_condition_group.id,
                    },
                    {
                        "type": Condition.LESS_OR_EQUAL,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.OK,
                        "conditionGroupId": self.data_condition_group.id,
                    },
                ],
            },
            "config": {
                "thresholdPeriod": 1,
                "detectionType": AlertRuleDetectionType.STATIC.value,
            },
            "workflowIds": [self.connected_workflow.id],
        }


@cell_silo_test
@with_feature("organizations:incidents")
class OrganizationProjectDetectorIndexPostTest(OrganizationProjectDetectorIndexBaseTest):
    def test_missing_group_type(self) -> None:
        data = {**self.valid_data}
        del data["type"]
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            **data,
            status_code=400,
        )
        assert response.data == {"type": ["This field is required."]}

    def test_invalid_group_type(self) -> None:
        data = {**self.valid_data, "type": "invalid_type"}
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            **data,
            status_code=400,
        )
        assert response.data == {
            "type": [get_unknown_detector_type_error("invalid_type", self.organization)]
        }

    def test_incompatible_group_type(self) -> None:
        with mock.patch.object(MetricIssue, "detector_settings", None):
            data = {**self.valid_data, "type": MetricIssue.slug}
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                **data,
                status_code=400,
            )
            assert response.data == {"type": ["Detector type not compatible with detectors"]}

    def test_without_feature_flag(self) -> None:
        with self.feature({"organizations:incidents": False}):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                **self.valid_data,
                status_code=404,
            )
        assert response.data == {
            "detail": ErrorDetail(string="The requested resource does not exist", code="error")
        }

    def test_project_not_found(self) -> None:
        self.get_error_response(
            self.organization.slug,
            "nonexistent-project-slug",
            **self.valid_data,
            status_code=404,
        )

    def test_project_belongs_to_different_org(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        self.get_error_response(
            self.organization.slug,
            other_project.slug,
            **self.valid_data,
            status_code=404,
        )

    def test_project_by_id(self) -> None:
        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                self.project.id,
                **self.valid_data,
                status_code=201,
            )
        assert response.data["projectId"] == str(self.project.id)

    def test_project_by_slug(self) -> None:
        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                **self.valid_data,
                status_code=201,
            )
        assert response.data["projectId"] == str(self.project.id)

    @mock.patch("sentry.incidents.metric_issue_detector.schedule_update_project_config")
    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_valid_creation(
        self,
        mock_audit: mock.MagicMock,
        mock_schedule_update_project_config: mock.MagicMock,
    ) -> None:
        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                **self.valid_data,
                status_code=201,
            )

        detector = Detector.objects.get(id=response.data["id"])
        assert response.data == serialize([detector])[0]
        assert detector.name == "Test Detector"
        assert detector.type == MetricIssue.slug
        assert detector.project_id == self.project.id
        assert detector.description is None

        # Verify data source
        data_source = DataSource.objects.get(detector=detector)
        assert data_source.type == data_source_type_registry.get_key(
            QuerySubscriptionDataSourceHandler
        )
        assert data_source.organization_id == self.organization.id

        # Verify query subscription
        query_sub = QuerySubscription.objects.get(id=int(data_source.source_id))
        assert query_sub.project == self.project
        assert query_sub.snuba_query.type == SnubaQuery.Type.ERROR.value
        assert query_sub.snuba_query.dataset == Dataset.Events.value
        assert query_sub.snuba_query.query == "test query"
        assert query_sub.snuba_query.aggregate == "count()"
        assert query_sub.snuba_query.time_window == 3600
        assert query_sub.snuba_query.environment == self.environment
        assert query_sub.snuba_query.event_types == [SnubaQueryEventType.EventType.ERROR]

        # Verify condition group and conditions
        condition_group = detector.workflow_condition_group
        assert condition_group
        assert condition_group.logic_type == DataConditionGroup.Type.ANY
        assert condition_group.organization_id == self.organization.id

        conditions = list(DataCondition.objects.filter(condition_group=condition_group))
        assert len(conditions) == 2
        condition = conditions[0]
        assert condition.type == Condition.GREATER
        assert condition.comparison == 100
        assert condition.condition_result == DetectorPriorityLevel.HIGH

        # Verify connected workflows
        detector_workflow = DetectorWorkflow.objects.get(
            detector=detector, workflow=self.connected_workflow
        )
        assert detector_workflow.detector == detector
        assert detector_workflow.workflow == self.connected_workflow

        # Verify audit log
        mock_audit.assert_called_once_with(
            request=mock.ANY,
            organization=self.organization,
            target_object=detector.id,
            event=mock.ANY,
            data=detector.get_audit_log_data(),
        )
        mock_schedule_update_project_config.assert_called_once_with(detector)

    def test_creation_with_description(self) -> None:
        data = {**self.valid_data, "description": "This is a test metric detector"}
        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                **data,
                status_code=201,
            )

        detector = Detector.objects.get(id=response.data["id"])
        assert detector.description == "This is a test metric detector"

    def test_invalid_workflow_ids(self) -> None:
        data = {**self.valid_data, "workflowIds": [999999]}
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            **data,
            status_code=400,
        )
        assert "Some workflows do not exist" in str(response.data)

        other_org = self.create_organization()
        other_workflow = self.create_workflow(organization_id=other_org.id)
        data = {**self.valid_data, "workflowIds": [other_workflow.id]}
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            **data,
            status_code=400,
        )
        assert "Some workflows do not exist" in str(response.data)

    def test_transaction_rollback_on_workflow_validation_failure(self) -> None:
        initial_detector_count = Detector.objects.filter(project=self.project).count()

        data = {**self.valid_data, "workflowIds": [999999]}
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            **data,
            status_code=400,
        )

        final_detector_count = Detector.objects.filter(project=self.project).count()
        assert final_detector_count == initial_detector_count
        assert "Some workflows do not exist" in str(response.data)

    def test_missing_required_field(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            status_code=400,
        )
        assert response.data == {"type": ["This field is required."]}

    def test_missing_name(self) -> None:
        data = {**self.valid_data}
        del data["name"]
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            **data,
            status_code=400,
        )
        assert response.data == {"name": ["This field is required."]}
