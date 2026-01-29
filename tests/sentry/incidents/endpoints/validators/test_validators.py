from unittest import mock

import orjson
import pytest
from django.utils import timezone
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
    ExtrapolationMode,
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
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.ERROR.value,
                    "dataset": Dataset.Events.value,
                    "query": "test query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                }
            ],
            "conditionGroup": {
                "logicType": self.data_condition_group.logic_type,
                "conditions": [
                    {
                        "type": Condition.GREATER,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.HIGH,
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
        }
        self.valid_anomaly_detection_data = {
            **self.valid_data,
            "conditionGroup": {
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
                    },
                ],
            },
            "config": {
                "thresholdPeriod": 1,
                "detectionType": AlertRuleDetectionType.DYNAMIC.value,
            },
        }

    def create_static_detector(self) -> Detector:
        validator = MetricIssueDetectorValidator(
            data=self.valid_data,
            context=self.context,
        )
        assert validator.is_valid(), validator.errors

        with self.tasks():
            static_detector = validator.save()

        # Verify detector in DB
        self.assert_validated(static_detector)

        # Verify condition group in DB
        condition_group = DataConditionGroup.objects.get(
            id=static_detector.workflow_condition_group_id
        )
        assert condition_group.logic_type == DataConditionGroup.Type.ANY
        assert condition_group.organization_id == self.project.organization_id

        # Verify conditions in DB
        conditions = list(DataCondition.objects.filter(condition_group=condition_group))
        assert len(conditions) == 2
        condition = conditions[0]
        assert condition.type == Condition.GREATER
        assert condition.comparison == 100
        assert condition.condition_result == DetectorPriorityLevel.HIGH

        return static_detector

    def create_dynamic_detector(self) -> Detector:
        validator = MetricIssueDetectorValidator(
            data=self.valid_anomaly_detection_data,
            context=self.context,
        )
        assert validator.is_valid(), validator.errors

        with self.tasks():
            detector = validator.save()

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

        return detector

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


class TestMetricAlertsCreateDetectorValidator(TestMetricAlertsDetectorValidator):

    @mock.patch("sentry.incidents.metric_issue_detector.schedule_update_project_config")
    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_create_with_valid_data(
        self, mock_audit: mock.MagicMock, mock_schedule_update_project_config
    ) -> None:
        detector = self.create_static_detector()

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

        detector = self.create_dynamic_detector()

        # Verify detector in DB
        self.assert_validated(detector)

        assert mock_seer_request.call_count == 1

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

    def test_no_resolution_condition(self) -> None:
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
                ],
            },
        }
        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("conditionGroup", {}).get("conditions") == [
            ErrorDetail(
                string="Resolution condition required for metric issue detector.", code="invalid"
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
                    {
                        "type": Condition.LESS_OR_EQUAL,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.OK,
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
            project=self.project,
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
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.Transactions.value,
                    "query": "test query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRANSACTION.name.lower()],
                }
            ],
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
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.PerformanceMetrics.value,
                    "query": "test query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRANSACTION.name.lower()],
                }
            ],
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

        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        with self.assertRaisesMessage(
            ValidationError,
            expected_message="Creation of transaction-based alerts is disabled, as we migrate to the span dataset. Create span-based alerts (dataset: events_analytics_platform) with the is_transaction:true filter instead.",
        ):
            validator.save()


class TestMetricAlertsTraceMetricsValidator(TestMetricAlertsDetectorValidator):
    def setUp(self) -> None:
        super().setUp()
        self.trace_metrics_data = {
            "name": "Trace Metrics Detector",
            "type": MetricIssue.slug,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.EventsAnalyticsPlatform.value,
                    "query": "",
                    "aggregate": "per_second(value,metric_name_one,counter,-)",
                    "timeWindow": 300,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_METRIC.name.lower()],
                }
            ],
            "conditionGroup": {
                "logicType": self.data_condition_group.logic_type,
                "conditions": [
                    {
                        "type": Condition.GREATER,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.HIGH,
                    },
                    {
                        "type": Condition.LESS_OR_EQUAL,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.OK,
                    },
                ],
            },
            "config": {
                "thresholdPeriod": 1,
                "detectionType": AlertRuleDetectionType.STATIC.value,
            },
        }

    @with_feature(
        {
            "organizations:performance-view": False,
            "organizations:tracemetrics-alerts": False,
            "organizations:tracemetrics-enabled": False,
        }
    )
    def test_create_detector_trace_metrics_feature_flag_disabled(self) -> None:
        validator = MetricIssueDetectorValidator(
            data=self.trace_metrics_data,
            context=self.context,
        )
        assert not validator.is_valid()
        data_sources_errors = validator.errors.get("dataSources")
        assert data_sources_errors is not None
        assert "You do not have access to the metrics alerts feature." in str(data_sources_errors)

    @with_feature(
        [
            "organizations:incidents",
            "organizations:performance-view",
            "organizations:tracemetrics-alerts",
            "organizations:tracemetrics-enabled",
        ]
    )
    def test_create_detector_trace_metrics_invalid_aggregate(self) -> None:
        data = {
            **self.trace_metrics_data,
            "dataSources": [
                {
                    **self.trace_metrics_data["dataSources"][0],  # type: ignore[index]
                    "aggregate": "count(trace.duration)",
                }
            ],
        }
        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert "Invalid trace metrics aggregate" in str(validator.errors)

    @with_feature(
        [
            "organizations:incidents",
            "organizations:performance-view",
            "organizations:tracemetrics-alerts",
            "organizations:tracemetrics-enabled",
        ]
    )
    def test_create_detector_trace_metrics_valid_aggregates(self) -> None:
        data_per_second = {
            **self.trace_metrics_data,
            "name": "Trace Metrics Per Second Detector",
            "dataSources": [
                {
                    **self.trace_metrics_data["dataSources"][0],  # type: ignore[index]
                    "aggregate": "per_second(value,metric_name_one,counter,-)",
                }
            ],
        }
        validator_per_second = MetricIssueDetectorValidator(
            data=data_per_second, context=self.context
        )
        assert validator_per_second.is_valid(), validator_per_second.errors

        with self.tasks():
            detector_per_second = validator_per_second.save()

        assert detector_per_second.name == "Trace Metrics Per Second Detector"
        data_source_per_second = DataSource.objects.get(detector=detector_per_second)
        query_sub_per_second = QuerySubscription.objects.get(id=data_source_per_second.source_id)
        assert (
            query_sub_per_second.snuba_query.aggregate
            == "per_second(value,metric_name_one,counter,-)"
        )

        data_count = {
            **self.trace_metrics_data,
            "name": "Trace Metrics Count Detector",
            "dataSources": [
                {
                    **self.trace_metrics_data["dataSources"][0],  # type: ignore[index]
                    "aggregate": "count(metric.name,metric_name_two,distribution,-)",
                }
            ],
        }
        validator_count = MetricIssueDetectorValidator(data=data_count, context=self.context)
        assert validator_count.is_valid(), validator_count.errors

        with self.tasks():
            detector_count = validator_count.save()

        assert detector_count.name == "Trace Metrics Count Detector"
        data_source_count = DataSource.objects.get(detector=detector_count)
        query_sub_count = QuerySubscription.objects.get(id=data_source_count.source_id)
        assert (
            query_sub_count.snuba_query.aggregate
            == "count(metric.name,metric_name_two,distribution,-)"
        )


class TestMetricAlertsUpdateDetectorValidator(TestMetricAlertsDetectorValidator):
    def test_update_with_valid_data(self) -> None:
        """
        Test a simple update
        """
        detector = self.create_static_detector()

        # the front end passes _all_ of the data, not just what changed
        new_name = "Testing My Cool Detector"
        update_data = {
            **self.valid_data,
            "id": detector.id,
            "projectId": self.project.id,
            "dateCreated": detector.date_added,
            "dateUpdated": timezone.now(),
            "conditionGroup": {
                "logicType": self.data_condition_group.logic_type,
                "conditions": [
                    {
                        "type": Condition.GREATER,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.HIGH,
                    },
                    {
                        "type": Condition.LESS_OR_EQUAL,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.OK,
                        "conditionGroupId": self.data_condition_group.id,
                    },
                ],
            },
            "name": new_name,  # change the name
        }
        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors
        updated_detector = update_validator.save()
        assert updated_detector.name == new_name

    def test_update_data_source_marks_query_as_user_updated_when_snapshot_exists(self) -> None:
        detector = self.create_static_detector()

        data_source = DataSource.objects.get(detector=detector)
        query_subscription = QuerySubscription.objects.get(id=data_source.source_id)
        snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query.id)

        snuba_query.query_snapshot = {
            "type": snuba_query.type,
            "dataset": snuba_query.dataset,
            "query": snuba_query.query,
            "aggregate": snuba_query.aggregate,
        }
        snuba_query.save()

        updated_query = "transaction.duration:>200"
        update_data = {
            **self.valid_data,
            "id": detector.id,
            "projectId": self.project.id,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.ERROR.value,
                    "dataset": Dataset.Events.value,
                    "query": updated_query,  # change the query
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                }
            ],
        }

        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors
        update_validator.save()

        snuba_query.refresh_from_db()
        assert snuba_query.query_snapshot is not None
        assert snuba_query.query_snapshot.get("user_updated") is True

    def test_update_data_source_does_not_mark_user_updated_when_no_snapshot(self) -> None:
        detector = self.create_static_detector()

        data_source = DataSource.objects.get(detector=detector)
        query_subscription = QuerySubscription.objects.get(id=data_source.source_id)
        snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query.id)

        snuba_query.query_snapshot = None
        snuba_query.save()

        updated_query = "transaction.duration:>200"
        update_data = {
            **self.valid_data,
            "id": detector.id,
            "projectId": self.project.id,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.ERROR.value,
                    "dataset": Dataset.Events.value,
                    "query": updated_query,  # change the query
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                }
            ],
        }

        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors
        update_validator.save()

        snuba_query.refresh_from_db()
        assert snuba_query.query_snapshot is None

    @mock.patch("sentry.seer.anomaly_detection.delete_rule.delete_rule_in_seer")
    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.seer_anomaly_detection_connection_pool.urlopen"
    )
    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_update_anomaly_detection_to_static(
        self,
        mock_audit: mock.MagicMock,
        mock_seer_store_request: mock.MagicMock,
        mock_seer_delete_request: mock.MagicMock,
    ) -> None:
        """
        Test that if a dynamic detector is changed to become a static one
        we tell Seer to delete the data for that detector
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_store_request.return_value = HTTPResponse(
            orjson.dumps(seer_return_value), status=200
        )
        mock_seer_delete_request.return_value = HTTPResponse(
            orjson.dumps(seer_return_value), status=200
        )

        dynamic_detector = self.create_dynamic_detector()

        # Verify detector in DB
        self.assert_validated(dynamic_detector)

        assert mock_seer_store_request.call_count == 1

        update_validator = MetricIssueDetectorValidator(
            instance=dynamic_detector,
            data=self.valid_data,
            context=self.context,
            partial=True,
        )
        assert update_validator.is_valid(), update_validator.errors
        update_validator.save()

        assert mock_seer_delete_request.call_count == 1

    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.seer_anomaly_detection_connection_pool.urlopen"
    )
    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_update_anomaly_detection_from_static(
        self, mock_audit: mock.MagicMock, mock_seer_request: mock.MagicMock
    ) -> None:
        """
        Test that if a static detector is changed to become a dynamic one
        we send the historical data to Seer for that detector
        """
        static_detector = self.create_static_detector()

        mock_audit.assert_called()
        mock_audit.reset_mock()

        # Change to become a dynamic detector
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        update_validator = MetricIssueDetectorValidator(
            instance=static_detector,
            data=self.valid_anomaly_detection_data,
            context=self.context,
            partial=True,
        )
        assert update_validator.is_valid(), update_validator.errors
        dynamic_detector = update_validator.save()

        assert mock_seer_request.call_count == 1

        # Verify detector in DB
        self.assert_validated(dynamic_detector)

        # Verify condition group in DB
        condition_group = DataConditionGroup.objects.get(
            id=dynamic_detector.workflow_condition_group_id
        )
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

        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=dynamic_detector.id,
            event=audit_log.get_event_id("DETECTOR_EDIT"),
            data=dynamic_detector.get_audit_log_data(),
        )

    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.seer_anomaly_detection_connection_pool.urlopen"
    )
    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_update_anomaly_detection_snuba_query_query(
        self, mock_audit: mock.MagicMock, mock_seer_request: mock.MagicMock
    ) -> None:
        """
        Test that when we update the snuba query query for a dynamic detector we make a call to Seer with the changes
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        detector = self.create_dynamic_detector()

        # Verify detector in DB
        self.assert_validated(detector)

        assert mock_seer_request.call_count == 1
        mock_seer_request.reset_mock()

        # Verify audit log
        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=detector.id,
            event=audit_log.get_event_id("DETECTOR_ADD"),
            data=detector.get_audit_log_data(),
        )
        mock_audit.reset_mock()

        # Change the snuba query which should call Seer
        updated_query = "different query"
        update_data = {
            **self.valid_anomaly_detection_data,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.ERROR.value,
                    "dataset": Dataset.Events.value,
                    "query": updated_query,  # this is what's changing
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                }
            ],
        }
        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors
        dynamic_detector = update_validator.save()

        assert mock_seer_request.call_count == 1
        mock_seer_request.reset_mock()

        # Verify snuba query changes
        data_source = DataSource.objects.get(detector=dynamic_detector)
        query_subscription = QuerySubscription.objects.get(id=data_source.source_id)
        snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query_id)
        assert snuba_query.query == updated_query

        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=dynamic_detector.id,
            event=audit_log.get_event_id("DETECTOR_EDIT"),
            data=dynamic_detector.get_audit_log_data(),
        )

    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.seer_anomaly_detection_connection_pool.urlopen"
    )
    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_update_anomaly_detection_snuba_query_aggregate(
        self, mock_audit: mock.MagicMock, mock_seer_request: mock.MagicMock
    ) -> None:
        """
        Test that when we update the snuba query aggregate for a dynamic detector we make a call to Seer with the changes
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        detector = self.create_dynamic_detector()

        # Verify detector in DB
        self.assert_validated(detector)

        assert mock_seer_request.call_count == 1
        mock_seer_request.reset_mock()

        # Verify audit log
        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=detector.id,
            event=audit_log.get_event_id("DETECTOR_ADD"),
            data=detector.get_audit_log_data(),
        )
        mock_audit.reset_mock()

        # Change the aggregate which should call Seer
        updated_aggregate = "count_unique(user)"
        update_data = {
            **self.valid_anomaly_detection_data,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.ERROR.value,
                    "dataset": Dataset.Events.value,
                    "query": "updated_query",
                    "aggregate": updated_aggregate,  # this is what's changing
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                }
            ],
        }
        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors
        dynamic_detector = update_validator.save()

        assert mock_seer_request.call_count == 1

        # Verify snuba query changes
        data_source = DataSource.objects.get(detector=dynamic_detector)
        query_subscription = QuerySubscription.objects.get(id=data_source.source_id)
        snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query_id)
        assert snuba_query.aggregate == "count_unique(tags[sentry:user])"

        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=dynamic_detector.id,
            event=audit_log.get_event_id("DETECTOR_EDIT"),
            data=dynamic_detector.get_audit_log_data(),
        )

    @mock.patch("sentry.seer.anomaly_detection.delete_rule.delete_rule_in_seer")
    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.seer_anomaly_detection_connection_pool.urlopen"
    )
    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_update_anomaly_detection_no_config(
        self,
        mock_audit: mock.MagicMock,
        mock_seer_request: mock.MagicMock,
        mock_seer_delete_request: mock.MagicMock,
    ) -> None:
        """
        Test that when we update the snuba query aggregate in dataSources ONLY (not passing other data) it works as expected
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        detector = self.create_dynamic_detector()

        # Verify detector in DB
        self.assert_validated(detector)

        assert mock_seer_request.call_count == 1
        mock_seer_request.reset_mock()

        # Verify audit log
        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=detector.id,
            event=audit_log.get_event_id("DETECTOR_ADD"),
            data=detector.get_audit_log_data(),
        )
        mock_audit.reset_mock()

        # Change the aggregate which should call Seer
        updated_aggregate = "count_unique(user)"
        update_data = {
            "dataSources": [
                {
                    # note we are NOT passing **self.valid_anomaly_detection_data
                    "queryType": SnubaQuery.Type.ERROR.value,
                    "dataset": Dataset.Events.value,
                    "query": "updated_query",
                    "aggregate": updated_aggregate,  # this is what's changing
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                }
            ],
        }
        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors
        dynamic_detector = update_validator.save()

        assert mock_seer_request.call_count == 1
        # ensure we did not enter the delete path
        assert mock_seer_delete_request.call_count == 0

        # Verify snuba query changes
        data_source = DataSource.objects.get(detector=dynamic_detector)
        query_subscription = QuerySubscription.objects.get(id=data_source.source_id)
        snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query_id)
        assert snuba_query.aggregate == "count_unique(tags[sentry:user])"

        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=dynamic_detector.id,
            event=audit_log.get_event_id("DETECTOR_EDIT"),
            data=dynamic_detector.get_audit_log_data(),
        )

    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.seer_anomaly_detection_connection_pool.urlopen"
    )
    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_update_anomaly_detection_snuba_query_to_perf(
        self, mock_audit: mock.MagicMock, mock_seer_request: mock.MagicMock
    ) -> None:
        """
        Test that when we update the snuba query for a dynamic detector
        to become a performance query we make a call to Seer with the changes
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        detector = self.create_dynamic_detector()
        assert mock_seer_request.call_count == 1
        mock_seer_request.reset_mock()
        mock_audit.reset_mock()

        # Change the dataset, queryType, and aggregate to perf stuff
        update_data = {
            **self.valid_anomaly_detection_data,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.EventsAnalyticsPlatform.value,
                    "query": "updated_query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRANSACTION.name.lower()],
                }
            ],
        }
        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors
        dynamic_detector = update_validator.save()

        assert mock_seer_request.call_count == 1

        # Verify snuba query changes
        data_source = DataSource.objects.get(detector=dynamic_detector)
        query_subscription = QuerySubscription.objects.get(id=data_source.source_id)
        snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query_id)
        assert snuba_query.aggregate == "count()"
        assert snuba_query.type == SnubaQuery.Type.PERFORMANCE.value
        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert snuba_query.query == "updated_query"

        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=dynamic_detector.id,
            event=audit_log.get_event_id("DETECTOR_EDIT"),
            data=dynamic_detector.get_audit_log_data(),
        )

    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.seer_anomaly_detection_connection_pool.urlopen"
    )
    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.handle_send_historical_data_to_seer"
    )
    def test_update_anomaly_detection_event_types(
        self, mock_send_historical_data: mock.MagicMock, mock_seer_request: mock.MagicMock
    ) -> None:
        """
        Test that when we update the eventTypes for a dynamic detector it gets sent through as expected
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        detector = self.create_dynamic_detector()
        assert mock_send_historical_data.call_count == 1
        mock_send_historical_data.reset_mock()

        # Change the dataset, queryType, aggregate, and eventTypes to performance data
        data_source_data = {
            "queryType": SnubaQuery.Type.PERFORMANCE.value,
            "dataset": Dataset.EventsAnalyticsPlatform.value,
            "query": "updated_query",
            "aggregate": "count()",
            "timeWindow": 3600,
            "environment": self.environment.name,
            "eventTypes": [SnubaQueryEventType.EventType.TRANSACTION.name.lower()],
        }
        update_data = {
            **self.valid_anomaly_detection_data,
            "dataSources": [data_source_data],
        }
        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors
        detector = update_validator.save()

        # Verify snuba query changes
        data_source = DataSource.objects.get(detector=detector)
        query_subscription = QuerySubscription.objects.get(id=data_source.source_id)
        snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query_id)
        condition_group = DataConditionGroup.objects.get(id=detector.workflow_condition_group_id)
        data_condition = DataCondition.objects.get(condition_group=condition_group)

        mock_send_historical_data.assert_called_once_with(
            detector,
            data_source,
            data_condition,
            snuba_query,
            detector.project,
            "update",
            [SnubaQueryEventType.EventType.TRANSACTION],
        )

    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_anomaly_detection__send_historical_data_update_fails(
        self, mock_seer_request: mock.MagicMock
    ) -> None:
        """
        Test that if the call to Seer fails when we try to change a detector's type to dynamic from static that we do not update the detector or data condition
        """
        static_detector = self.create_static_detector()

        # Attempt to convert detector to dynamic type
        mock_seer_request.side_effect = TimeoutError

        update_validator = MetricIssueDetectorValidator(
            instance=static_detector,
            data=self.valid_anomaly_detection_data,
            context=self.context,
            partial=True,
        )
        assert update_validator.is_valid(), update_validator.errors

        with self.tasks(), pytest.raises(ValidationError):
            update_validator.save()

        # Re-fetch the models and ensure they're not updated
        detector = Detector.objects.get(id=static_detector.id)
        assert detector.config.get("detection_type") == AlertRuleDetectionType.STATIC.value

        condition_group = DataConditionGroup.objects.get(id=detector.workflow_condition_group_id)
        assert condition_group.logic_type == DataConditionGroup.Type.ANY
        assert condition_group.organization_id == self.project.organization_id

        conditions = list(DataCondition.objects.filter(condition_group=condition_group))
        assert len(conditions) == 2
        condition = conditions[0]
        assert condition.type == Condition.GREATER
        assert condition.comparison == 100
        assert condition.condition_result == DetectorPriorityLevel.HIGH

    @mock.patch(
        "sentry.seer.anomaly_detection.store_data_workflow_engine.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_anomaly_detection__send_historical_data_snuba_update_fails(
        self, mock_seer_request: mock.MagicMock
    ) -> None:
        """
        Test that if the call to Seer fails when we try to change a dynamic detector's snuba query that we do not update the snuba query
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        detector = self.create_dynamic_detector()

        # Attempt to change the snuba query's query
        mock_seer_request.side_effect = TimeoutError

        updated_query = "different query"
        update_data = {
            **self.valid_anomaly_detection_data,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.ERROR.value,
                    "dataset": Dataset.Events.value,
                    "query": updated_query,  # this is what's changing
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                }
            ],
        }
        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors

        with self.tasks(), pytest.raises(ValidationError):
            update_validator.save()

        # Fetch data and ensure it hasn't changed
        data_source = DataSource.objects.get(detector=detector)
        query_sub = QuerySubscription.objects.get(id=data_source.source_id)
        snuba_query = query_sub.snuba_query
        assert snuba_query.query == "test query"

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
        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        detector = validator.save()

        update_data = {
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.PerformanceMetrics.value,
                    "query": "updated query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRANSACTION.name.lower()],
                }
            ],
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

    def test_invalid_extrapolation_mode_create(self) -> None:
        data = {
            **self.valid_data,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.EventsAnalyticsPlatform.value,
                    "query": "test query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
                    "extrapolation_mode": ExtrapolationMode.SERVER_WEIGHTED.name.lower(),
                },
            ],
        }

        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        with self.assertRaisesMessage(
            ValidationError,
            expected_message="server_weighted extrapolation mode is not supported for new detectors.",
        ):
            validator.save()

    def test_invalid_extrapolation_mode_update(self) -> None:
        data = {
            **self.valid_data,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.EventsAnalyticsPlatform.value,
                    "query": "test query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
                    "extrapolation_mode": ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.name.lower(),
                },
            ],
        }

        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors

        detector = validator.save()

        update_data = {
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.EventsAnalyticsPlatform.value,
                    "query": "updated query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
                    "extrapolation_mode": ExtrapolationMode.SERVER_WEIGHTED.name.lower(),
                }
            ],
        }
        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )
        assert update_validator.is_valid(), update_validator.errors
        with self.assertRaisesMessage(
            ValidationError,
            expected_message="Invalid extrapolation mode for this detector type.",
        ):
            update_validator.save()

    def test_nonexistent_extrapolation_mode_create(self) -> None:
        data = {
            **self.valid_data,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.EventsAnalyticsPlatform.value,
                    "query": "test query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
                    "extrapolation_mode": "blah",
                },
            ],
        }

        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid(), validator.errors
        assert (
            validator.errors["dataSources"]["extrapolationMode"][0]
            == "Invalid extrapolation mode: blah"
        )

    def test_nonexistent_extrapolation_mode_update(self) -> None:
        data = {
            **self.valid_data,
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.EventsAnalyticsPlatform.value,
                    "query": "test query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
                    "extrapolation_mode": ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.name.lower(),
                },
            ],
        }

        validator = MetricIssueDetectorValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors

        detector = validator.save()

        update_data = {
            "dataSources": [
                {
                    "queryType": SnubaQuery.Type.PERFORMANCE.value,
                    "dataset": Dataset.EventsAnalyticsPlatform.value,
                    "query": "updated query",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": self.environment.name,
                    "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
                    "extrapolation_mode": "blah",
                }
            ],
        }
        update_validator = MetricIssueDetectorValidator(
            instance=detector, data=update_data, context=self.context, partial=True
        )

        assert not update_validator.is_valid(), update_validator.errors
        assert (
            update_validator.errors["dataSources"]["extrapolationMode"][0]
            == "Invalid extrapolation mode: blah"
        )
