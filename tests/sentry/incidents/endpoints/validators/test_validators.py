from unittest import mock

from rest_framework.exceptions import ErrorDetail

from sentry import audit_log
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.metric_alert_detector import (
    MetricAlertComparisonConditionValidator,
    MetricAlertsDetectorValidator,
)
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.models.environment import Environment
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    QuerySubscription,
    QuerySubscriptionDataSourceHandler,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.endpoints.test_validators import BaseValidatorTest


class MetricAlertComparisonConditionValidatorTest(BaseValidatorTest):
    def test(self):
        validator = MetricAlertComparisonConditionValidator(
            data={
                "type": Condition.GREATER,
                "comparison": 100,
                "conditionResult": DetectorPriorityLevel.HIGH,
                "conditionGroupId": self.data_condition_group.id,
            }
        )
        assert validator.is_valid()
        assert validator.validated_data == {
            "comparison": 100.0,
            "condition_result": DetectorPriorityLevel.HIGH,
            "type": Condition.GREATER,
            "condition_group_id": self.data_condition_group.id,
        }

    def test_invalid_condition(self):
        unsupported_condition = Condition.EQUAL
        data = {
            "type": unsupported_condition,
            "comparison": 100,
            "result": DetectorPriorityLevel.HIGH,
        }
        validator = MetricAlertComparisonConditionValidator(data=data)
        assert not validator.is_valid()
        assert validator.errors.get("type") == [
            ErrorDetail(string=f"Unsupported type {unsupported_condition}", code="invalid")
        ]

    def test_unregistered_condition(self):
        validator = MetricAlertComparisonConditionValidator(
            data={"type": "invalid", "comparison": 100, "result": DetectorPriorityLevel.HIGH}
        )
        assert not validator.is_valid()
        assert validator.errors.get("type") == [
            ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
        ]

    def test_invalid_comparison(self):
        validator = MetricAlertComparisonConditionValidator(
            data={
                "type": Condition.GREATER,
                "comparison": "not_a_number",
                "result": DetectorPriorityLevel.HIGH,
            }
        )
        assert not validator.is_valid()
        assert validator.errors.get("comparison") == [
            ErrorDetail(string="A valid number is required.", code="invalid")
        ]

    def test_invalid_result(self):
        validator = MetricAlertComparisonConditionValidator(
            data={
                "type": Condition.GREATER,
                "comparison": 100,
                "condition_result": 25,
                "condition_group_id": self.data_condition_group.id,
            }
        )
        assert not validator.is_valid()
        assert validator.errors.get("conditionResult") == [
            ErrorDetail(string="Unsupported condition result", code="invalid")
        ]


class TestMetricAlertsDetectorValidator(BaseValidatorTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.environment = Environment.objects.create(
            organization_id=self.project.organization_id, name="production"
        )
        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }
        self.valid_data = {
            "name": "Test Detector",
            "detectorType": MetricIssue.slug,
            "dataSource": {
                "query_type": SnubaQuery.Type.ERROR.value,
                "dataset": Dataset.Events.value,
                "query": "test query",
                "aggregate": "count()",
                "time_window": 60,
                "environment": self.environment.name,
                "event_types": [SnubaQueryEventType.EventType.ERROR.name.lower()],
            },
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
                ],
            },
            "config": {
                "threshold_period": 1,
                "detection_type": AlertRuleDetectionType.STATIC.value,
            },
        }

    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_create_with_valid_data(self, mock_audit):
        validator = MetricAlertsDetectorValidator(
            data=self.valid_data,
            context=self.context,
        )
        assert validator.is_valid(), validator.errors

        with self.tasks():
            detector = validator.save()

        # Verify detector in DB
        detector = Detector.objects.get(id=detector.id)
        assert detector.name == "Test Detector"
        assert detector.type == MetricIssue.slug
        assert detector.project_id == self.project.id

        # Verify data source and query subscription in DB
        data_source = DataSource.objects.get(detector=detector)
        assert data_source.type == data_source_type_registry.get_key(
            QuerySubscriptionDataSourceHandler
        )
        assert data_source.organization_id == self.project.organization_id

        query_sub = QuerySubscription.objects.get(id=data_source.source_id)
        assert query_sub.project == self.project
        assert query_sub.type == INCIDENTS_SNUBA_SUBSCRIPTION_TYPE

        # Verify the Snuba query
        snuba_query = query_sub.snuba_query
        assert snuba_query
        assert snuba_query.type == SnubaQuery.Type.ERROR.value
        assert snuba_query.dataset == Dataset.Events.value
        assert snuba_query.query == "test query"
        assert snuba_query.aggregate == "count()"
        assert snuba_query.time_window == 3600
        assert snuba_query.environment == self.environment
        assert snuba_query.event_types == [SnubaQueryEventType.EventType.ERROR]

        # Verify condition group in DB
        condition_group = DataConditionGroup.objects.get(id=detector.workflow_condition_group_id)
        assert condition_group.logic_type == DataConditionGroup.Type.ANY
        assert condition_group.organization_id == self.project.organization_id

        # Verify conditions in DB
        conditions = list(DataCondition.objects.filter(condition_group=condition_group))
        assert len(conditions) == 1
        condition = conditions[0]
        assert condition.type == Condition.GREATER
        assert condition.comparison == 100
        assert condition.condition_result == DetectorPriorityLevel.HIGH

        # Verify audit log
        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=detector.id,
            event=audit_log.get_event_id("DETECTOR_ADD"),
            data=detector.get_audit_log_data(),
        )

    def test_invalid_detector_type(self):
        data = {**self.valid_data, "detectorType": "invalid_type"}
        validator = MetricAlertsDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("detectorType") == [
            ErrorDetail(string="Unknown detector type", code="invalid")
        ]

    def test_too_many_conditions(self):
        data = {
            **self.valid_data,
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
                        "type": Condition.GREATER,
                        "comparison": 200,
                        "conditionResult": DetectorPriorityLevel.HIGH,
                        "conditionGroupId": self.data_condition_group.id,
                    },
                    {
                        "type": Condition.GREATER,
                        "comparison": 300,
                        "conditionResult": DetectorPriorityLevel.HIGH,
                        "conditionGroupId": self.data_condition_group.id,
                    },
                ],
            },
        }
        validator = MetricAlertsDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("nonFieldErrors") == [
            ErrorDetail(string="Too many conditions", code="invalid")
        ]
