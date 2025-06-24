from unittest import mock

from rest_framework.exceptions import ErrorDetail

from sentry import audit_log
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.metric_issue_detector import (
    MetricIssueComparisonConditionValidator,
    MetricIssueDetectorValidator,
)
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.models.environment import Environment
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
)
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


class MetricIssueComparisonConditionValidatorTest(BaseValidatorTest):
    def setUp(self):
        super().setUp()
        self.valid_data = {
            "type": Condition.GREATER,
            "comparison": 100,
            "conditionResult": DetectorPriorityLevel.HIGH,
            "conditionGroupId": self.data_condition_group.id,
        }

    def test(self):
        validator = MetricIssueComparisonConditionValidator(data=self.valid_data)
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
            **self.valid_data,
            "type": unsupported_condition,
        }
        validator = MetricIssueComparisonConditionValidator(data=data)
        assert not validator.is_valid()
        assert validator.errors.get("type") == [
            ErrorDetail(string=f"Unsupported type {unsupported_condition}", code="invalid")
        ]

    def test_unregistered_condition(self):
        validator = MetricIssueComparisonConditionValidator(
            data={**self.valid_data, "type": "invalid"}
        )
        assert not validator.is_valid()
        assert validator.errors.get("type") == [
            ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
        ]

    def test_invalid_comparison(self):
        validator = MetricIssueComparisonConditionValidator(
            data={
                **self.valid_data,
                "comparison": "not_a_number",
            }
        )
        assert not validator.is_valid()
        assert validator.errors.get("comparison") == [
            ErrorDetail(string="A valid number or dict is required.", code="invalid")
        ]

    def test_invalid_comparison_dict(self):
        comparison = {"foo": "bar"}
        validator = MetricIssueComparisonConditionValidator(
            data={
                **self.valid_data,
                "comparison": comparison,
            }
        )
        assert not validator.is_valid()
        assert validator.errors.get("comparison") == [
            ErrorDetail(
                string=f"Invalid json primitive value: {comparison}. Must be a string, number, or boolean.",
                code="invalid",
            )
        ]

    def test_invalid_result(self):
        validator = MetricIssueComparisonConditionValidator(
            data={
                **self.valid_data,
                "conditionResult": 25,
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
            "type": MetricIssue.slug,
            "dataSource": {
                "queryType": SnubaQuery.Type.ERROR.value,
                "dataset": Dataset.Events.value,
                "query": "test query",
                "aggregate": "count()",
                "timeWindow": 3600,
                "environment": self.environment.name,
                "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
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
                "thresholdPeriod": 1,
                "detectionType": AlertRuleDetectionType.STATIC.value,
            },
        }

    def assert_validated(self, detector):
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

    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_create_with_valid_data(self, mock_audit):
        validator = MetricIssueDetectorValidator(
            data=self.valid_data,
            context=self.context,
        )
        assert validator.is_valid(), validator.errors

        with self.tasks():
            detector = validator.save()

        # Verify detector in DB
        self.assert_validated(detector)
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

    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_anomaly_detection(self, mock_audit):
        data = {
            **self.valid_data,
            "conditionGroup": {
                "id": self.data_condition_group.id,
                "organizationId": self.organization.id,
                "logicType": self.data_condition_group.logic_type,
                "conditions": [
                    {
                        "type": Condition.ANOMALY_DETECTION,
                        "comparison": {
                            "sensitivity": AnomalyDetectionSensitivity.HIGH,
                            "seasonality": AnomalyDetectionSeasonality.AUTO,
                            "threshold_type": AnomalyDetectionThresholdType.ABOVE_AND_BELOW,
                        },
                        "conditionResult": DetectorPriorityLevel.HIGH,
                        "conditionGroupId": self.data_condition_group.id,
                    },
                ],
            },
            "config": {
                "threshold_period": 1,
                "detection_type": AlertRuleDetectionType.DYNAMIC.value,
            },
        }
        validator = MetricIssueDetectorValidator(
            data=data,
            context=self.context,
        )
        assert validator.is_valid(), validator.errors

        with self.tasks():
            detector = validator.save()

        # Verify detector in DB
        self.assert_validated(detector)

        # Verify condition group in DB
        condition_group = DataConditionGroup.objects.get(id=detector.workflow_condition_group_id)
        assert condition_group.logic_type == DataConditionGroup.Type.ANY
        assert condition_group.organization_id == self.project.organization_id

        # Verify conditions in DB
        conditions = list(DataCondition.objects.filter(condition_group=condition_group))
        assert len(conditions) == 1

        condition = conditions[0]
        assert condition.type == Condition.ANOMALY_DETECTION
        assert condition.comparison == {
            "sensitivity": AnomalyDetectionSensitivity.HIGH,
            "seasonality": AnomalyDetectionSeasonality.AUTO,
            "threshold_type": AnomalyDetectionThresholdType.ABOVE_AND_BELOW,
        }
        assert condition.condition_result == DetectorPriorityLevel.HIGH

        # Verify audit log
        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=detector.id,
            event=audit_log.get_event_id("DETECTOR_ADD"),
            data=detector.get_audit_log_data(),
        )

    def test_anomaly_detection__invalid_comparison(self):
        data = {
            **self.valid_data,
            "conditionGroup": {
                "id": self.data_condition_group.id,
                "organizationId": self.organization.id,
                "logicType": self.data_condition_group.logic_type,
                "conditions": [
                    {
                        "type": Condition.ANOMALY_DETECTION,
                        "comparison": {
                            "sensitivity": "super sensitive",
                            "seasonality": AnomalyDetectionSeasonality.AUTO,
                            "threshold_type": AnomalyDetectionThresholdType.ABOVE_AND_BELOW,
                        },
                        "conditionResult": DetectorPriorityLevel.HIGH,
                        "conditionGroupId": self.data_condition_group.id,
                    },
                ],
            },
            "config": {
                "threshold_period": 1,
                "detection_type": AlertRuleDetectionType.DYNAMIC.value,
            },
        }
        validator = MetricIssueDetectorValidator(
            data=data,
            context=self.context,
        )
        assert not validator.is_valid()

    def test_invalid_detector_type(self):
        data = {**self.valid_data, "type": "invalid_type"}
        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("type") == [
            ErrorDetail(
                string="Unknown detector type 'invalid_type'. Must be one of: error", code="invalid"
            )
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
        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("nonFieldErrors") == [
            ErrorDetail(string="Too many conditions", code="invalid")
        ]
