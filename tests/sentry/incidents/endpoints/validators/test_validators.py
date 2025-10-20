from unittest import mock

import orjson
import pytest
from rest_framework.exceptions import ErrorDetail, ValidationError
from urllib3.exceptions import MaxRetryError, TimeoutError
from urllib3.response import HTTPResponse

from sentry import audit_log
from sentry.conf.server import SEER_ANOMALY_DETECTION_STORE_DATA_URL
from sentry.constants import ObjectStatus
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.metric_issue_detector import (
    MetricIssueComparisonConditionValidator,
    MetricIssueDetectorValidator,
)
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.models.environment import Environment
from sentry.seer.anomaly_detection.store_data import seer_anomaly_detection_connection_pool
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
    StoreDataResponse,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    QuerySubscription,
    QuerySubscriptionDataSourceHandler,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.endpoints.validators.utils import get_unknown_detector_type_error
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.endpoints.test_validators import BaseValidatorTest

pytestmark = pytest.mark.sentry_metrics


class MetricIssueComparisonConditionValidatorTest(BaseValidatorTest):
    def setUp(self) -> None:
        super().setUp()
        self.valid_data = {
            "type": Condition.GREATER,
            "comparison": 100,
            "conditionResult": DetectorPriorityLevel.HIGH,
            "conditionGroupId": self.data_condition_group.id,
        }

    def test(self) -> None:
        validator = MetricIssueComparisonConditionValidator(data=self.valid_data)
        assert validator.is_valid()
        assert validator.validated_data == {
            "comparison": 100.0,
            "condition_result": DetectorPriorityLevel.HIGH,
            "type": Condition.GREATER,
            "condition_group_id": self.data_condition_group.id,
        }

    def test_invalid_condition(self) -> None:
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

    def test_unregistered_condition(self) -> None:
        validator = MetricIssueComparisonConditionValidator(
            data={**self.valid_data, "type": "invalid"}
        )
        assert not validator.is_valid()
        assert validator.errors.get("type") == [
            ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
        ]

    def test_invalid_comparison(self) -> None:
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

    def test_invalid_comparison_dict(self) -> None:
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

    def test_invalid_result(self) -> None:
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
    def setUp(self) -> None:
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
        self.valid_anomaly_detection_data = {
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

    @mock.patch("sentry.incidents.metric_issue_detector.schedule_update_project_config")
    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_create_with_valid_data(
        self, mock_audit: mock.MagicMock, mock_schedule_update_project_config
    ) -> None:
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
        mock_schedule_update_project_config.assert_called_once_with(detector)

    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.seer_anomaly_detection_connection_pool.urlopen"
    )
    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_anomaly_detection(
        self, mock_audit: mock.MagicMock, mock_seer_request: mock.MagicMock
    ) -> None:
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        validator = MetricIssueDetectorValidator(
            data=self.valid_anomaly_detection_data,
            context=self.context,
        )
        assert validator.is_valid(), validator.errors

        with self.tasks():
            detector = validator.save()

        # Verify detector in DB
        self.assert_validated(detector)

        assert mock_seer_request.call_count == 1

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

    def test_anomaly_detection__invalid_comparison(self) -> None:
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

    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_anomaly_detection__send_historical_data_fails(
        self, mock_seer_request: mock.MagicMock
    ) -> None:
        """
        Test that if the call to Seer fails that we do not create the detector, dcg, and data condition
        """
        from django.core.exceptions import ValidationError

        mock_seer_request.side_effect = TimeoutError

        assert not DataCondition.objects.filter(type=Condition.ANOMALY_DETECTION).exists()
        DataConditionGroup.objects.all().delete()

        validator = MetricIssueDetectorValidator(
            data=self.valid_anomaly_detection_data,
            context=self.context,
        )
        assert validator.is_valid(), validator.errors

        detector = None
        with self.tasks(), pytest.raises(ValidationError):
            detector = validator.save()

        assert not detector
        assert not DataCondition.objects.filter(type=Condition.ANOMALY_DETECTION).exists()
        assert DataConditionGroup.objects.all().count() == 0

        mock_seer_request.side_effect = MaxRetryError(
            seer_anomaly_detection_connection_pool, SEER_ANOMALY_DETECTION_STORE_DATA_URL
        )
        validator = MetricIssueDetectorValidator(
            data=self.valid_anomaly_detection_data,
            context=self.context,
        )
        assert validator.is_valid(), validator.errors

        with self.tasks(), pytest.raises(ValidationError):
            detector = validator.save()

        assert not detector
        assert not DataCondition.objects.filter(type=Condition.ANOMALY_DETECTION).exists()
        assert DataConditionGroup.objects.all().count() == 0

    def test_invalid_detector_type(self) -> None:
        data = {**self.valid_data, "type": "invalid_type"}
        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("type") == [
            ErrorDetail(
                string=get_unknown_detector_type_error("invalid_type", self.organization),
                code="invalid",
            )
        ]

    def test_too_many_conditions(self) -> None:
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

    @mock.patch("sentry.quotas.backend.get_metric_detector_limit")
    def test_enforce_quota_feature_disabled(self, mock_get_limit: mock.MagicMock) -> None:
        mock_get_limit.return_value = 0
        validator = MetricIssueDetectorValidator(data=self.valid_data, context=self.context)

        assert validator.is_valid()
        assert validator.save()

    @mock.patch("sentry.quotas.backend.get_metric_detector_limit")
    @with_feature("organizations:workflow-engine-metric-detector-limit")
    def test_enforce_quota_within_limit(self, mock_get_limit: mock.MagicMock) -> None:
        mock_get_limit.return_value = 1

        # Create a not-metric detector
        self.create_detector(
            project_id=self.project.id,
            name="Error Detector",
            status=ObjectStatus.ACTIVE,
        )
        # Create 3 inactive detectors
        for status in [
            ObjectStatus.DISABLED,
            ObjectStatus.PENDING_DELETION,
            ObjectStatus.DELETION_IN_PROGRESS,
        ]:
            self.create_detector(
                project_id=self.project.id,
                name=f"Inactive Detector {status}",
                type=MetricIssue.slug,
                status=status,
            )

        validator = MetricIssueDetectorValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid()
        assert validator.save()
        mock_get_limit.assert_called_once_with(self.project.organization.id)

        validator = MetricIssueDetectorValidator(data=self.valid_data, context=self.context)
        validator.is_valid()
        with self.assertRaisesMessage(
            ValidationError,
            expected_message="Used 1/1 of allowed metric_issue monitors.",
        ):
            validator.save()

    @with_feature("organizations:discover-saved-queries-deprecation")
    def test_transaction_dataset_deprecation_transactions(self) -> None:
        data = {
            **self.valid_data,
            "dataSource": {
                "queryType": SnubaQuery.Type.PERFORMANCE.value,
                "dataset": Dataset.Transactions.value,
                "query": "test query",
                "aggregate": "count()",
                "timeWindow": 3600,
                "environment": self.environment.name,
                "eventTypes": [SnubaQueryEventType.EventType.TRANSACTION.name.lower()],
            },
        }
        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        with self.assertRaisesMessage(
            ValidationError,
            expected_message="Creation of transaction-based alerts is disabled, as we migrate to the span dataset. Create span-based alerts (dataset: events_analytics_platform) with the is_transaction:true filter instead.",
        ):
            validator.save()

    @with_feature("organizations:discover-saved-queries-deprecation")
    @with_feature("organizations:mep-rollout-flag")
    def test_transaction_dataset_deprecation_generic_metrics(self) -> None:
        data = {
            **self.valid_data,
            "dataSource": {
                "queryType": SnubaQuery.Type.PERFORMANCE.value,
                "dataset": Dataset.PerformanceMetrics.value,
                "query": "test query",
                "aggregate": "count()",
                "timeWindow": 3600,
                "environment": self.environment.name,
                "eventTypes": [SnubaQueryEventType.EventType.TRANSACTION.name.lower()],
            },
        }
        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        with self.assertRaisesMessage(
            ValidationError,
            expected_message="Creation of transaction-based alerts is disabled, as we migrate to the span dataset. Create span-based alerts (dataset: events_analytics_platform) with the is_transaction:true filter instead.",
        ):
            validator.save()

    @with_feature("organizations:discover-saved-queries-deprecation")
    def test_transaction_dataset_deprecation_multiple_data_sources(self) -> None:
        data = {
            **self.valid_data,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.Transactions.value,
                    "query": "test query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRANSACTION.name.lower()],
                },
            ],
        }
        data.pop("dataSource", None)
        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        with self.assertRaisesMessage(
            ValidationError,
            expected_message="Creation of transaction-based alerts is disabled, as we migrate to the span dataset. Create span-based alerts (dataset: events_analytics_platform) with the is_transaction:true filter instead.",
        ):
            validator.save()

    @with_feature("organizations:discover-saved-queries-deprecation")
    def test_update_allowed_even_with_deprecated_dataset(self) -> None:
        # Updates should be allowed even when the feature flag is enabled
        # The deprecation only applies to creation, not updates
        validator = MetricIssueDetectorValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid(), validator.errors
        detector = validator.save()

        # Update other fields (like name) should work fine
        update_data = {
            "name": "Updated Detector Name",
        }
        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors
        updated_detector = update_validator.save()
        assert updated_detector.name == "Updated Detector Name"

    @with_feature("organizations:mep-rollout-flag")
    def test_transaction_dataset_deprecation_generic_metrics_update(self) -> None:
        data = {
            **self.valid_data,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.PerformanceMetrics.value,
                    "query": "test query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRANSACTION.name.lower()],
                },
            ],
        }
        data.pop("dataSource", None)
        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        detector = validator.save()

        update_data = {
            "dataSource": {
                "queryType": SnubaQuery.Type.PERFORMANCE.value,
                "dataset": Dataset.PerformanceMetrics.value,
                "query": "updated query",
                "aggregate": "count()",
                "timeWindow": 3600,
                "environment": self.environment.name,
                "eventTypes": [SnubaQueryEventType.EventType.TRANSACTION.name.lower()],
            },
        }
        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors
        with (
            self.assertRaisesMessage(
                ValidationError,
                expected_message="Updates to transaction-based alerts is disabled, as we migrate to the span dataset. Create span-based alerts (dataset: events_analytics_platform) with the is_transaction:true filter instead.",
            ),
            with_feature("organizations:discover-saved-queries-deprecation"),
        ):
            update_validator.save()


class TestMetricAlertDetectorDataSourcesValidator(TestMetricAlertsDetectorValidator):
    def setUp(self) -> None:
        """
        These are a temporary suite of tests that run the same ones as `TestMetricAlertsDetectorValidator`
        but changes the dataSource attribute to dataSources.
        """
        super().setUp()

        data_source = self.valid_data["dataSource"]

        # This is a temporary line of code; works fine when inlining the [] which
        # is the longer term solution.
        self.valid_data["dataSources"] = [data_source]  # type: ignore[list-item]
        del self.valid_data["dataSource"]
