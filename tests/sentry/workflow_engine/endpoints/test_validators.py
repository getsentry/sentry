from unittest import mock

import pytest
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail, ValidationError

from sentry import audit_log
from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.models.environment import Environment
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    QuerySubscription,
    QuerySubscriptionDataSourceHandler,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.snuba.snuba_query_validator import SnubaQueryValidator
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import (
    BaseDataConditionGroupValidator,
    BaseDataSourceValidator,
    BaseDetectorTypeValidator,
    DataSourceCreator,
    NumericComparisonConditionValidator,
)
from sentry.workflow_engine.endpoints.validators.metric_alert_detector import (
    MetricAlertComparisonConditionValidator,
    MetricAlertsDetectorValidator,
)
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, DataSource
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DetectorPriorityLevel


class BaseValidatorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.data_condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )


class TestNumericComparisonConditionValidator(BaseValidatorTest):
    def setUp(self):
        super().setUp()

        # Create a concrete implementation for testing
        class ConcreteNumericValidator(NumericComparisonConditionValidator):
            @property
            def supported_conditions(self):
                return frozenset([Condition.GREATER, Condition.LESS])

            @property
            def supported_condition_results(self):
                return frozenset([DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW])

        self.validator_class = ConcreteNumericValidator

    def test_validate_condition_valid(self):
        validator = self.validator_class()
        assert validator.validate_type("gt") == Condition.GREATER

    def test_validate_condition_invalid(self):
        validator = self.validator_class()
        with pytest.raises(
            ValidationError,
            match="[ErrorDetail(string='Unsupported type invalid_condition', code='invalid')]",
        ):
            validator.validate_type("invalid_condition")

    def test_validate_result_valid(self):
        validator = self.validator_class()
        assert validator.validate_condition_result("75") == DetectorPriorityLevel.HIGH

    def test_validate_result_invalid(self):
        validator = self.validator_class()
        with pytest.raises(
            ValidationError,
            match="[ErrorDetail(string='Unsupported condition result', code='invalid')]",
        ):
            validator.validate_condition_result("invalid_result")


class TestBaseGroupTypeDetectorValidator(BaseValidatorTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()

        self.validator_class = BaseDetectorTypeValidator

    def test_validate_detector_type_valid(self):
        with mock.patch.object(grouptype.registry, "get_by_slug") as mock_get_by_slug:
            mock_get_by_slug.return_value = GroupType(
                type_id=1,
                slug="test_type",
                description="no handler",
                category=GroupCategory.METRIC_ALERT.value,
                detector_validator=MetricAlertsDetectorValidator,
            )
            validator = self.validator_class()
            result = validator.validate_detector_type("test_type")
            assert result == mock_get_by_slug.return_value

    def test_validate_detector_type_unknown(self):
        with mock.patch.object(grouptype.registry, "get_by_slug", return_value=None):
            validator = self.validator_class()
            with pytest.raises(
                ValidationError,
                match="[ErrorDetail(string='Unknown detector type', code='invalid')]",
            ):
                validator.validate_detector_type("unknown_type")

    def test_validate_detector_type_incompatible(self):
        with mock.patch.object(grouptype.registry, "get_by_slug") as mock_get_by_slug:
            mock_get_by_slug.return_value = GroupType(
                type_id=1,
                slug="test_type",
                description="no handler",
                category=GroupCategory.METRIC_ALERT.value,
                detector_validator=None,
            )
            validator = self.validator_class()
            with pytest.raises(
                ValidationError,
                match="[ErrorDetail(string='Detector type not compatible with detectors', code='invalid')]",
            ):
                validator.validate_detector_type("test_type")


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
        validator = MetricAlertComparisonConditionValidator(
            data={"type": "invalid", "comparison": 100, "result": DetectorPriorityLevel.HIGH}
        )
        assert not validator.is_valid()
        assert validator.errors.get("type") == [
            ErrorDetail(string="Unsupported type invalid", code="invalid")
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


class DetectorValidatorTest(BaseValidatorTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }
        self.valid_data = {
            "name": "Test Detector",
            "detectorType": MetricAlertFire.slug,
            "dataSources": [
                {
                    "field1": "test",
                    "field2": 123,
                },
            ],
            "conditionGroup": {
                "id": self.data_condition_group.id,
                "organizationId": self.organization.id,
                "logicType": self.data_condition_group.logic_type,
                "conditions": [
                    {
                        "type": Condition.GREATER_OR_EQUAL,
                        "comparison": 100,
                        "condition_result": DetectorPriorityLevel.HIGH,
                        "conditionGroupId": self.data_condition_group.id,
                    }
                ],
            },
            "config": {
                "threshold_period": 1,
                "detection_type": AlertRuleDetectionType.STATIC.value,
            },
        }

    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_create_with_mock_validator(self, mock_audit):
        validator = MockDetectorValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid(), validator.errors
        detector = validator.save()

        # Verify detector in DB
        detector = Detector.objects.get(id=detector.id)
        assert detector.name == "Test Detector"
        assert detector.type == MetricAlertFire.slug
        assert detector.project_id == self.project.id

        # Verify data source in DB
        data_source = DataSource.objects.get(detector=detector)
        assert data_source.type == data_source_type_registry.get_key(
            QuerySubscriptionDataSourceHandler
        )
        assert data_source.organization_id == self.project.organization_id

        # Verify condition group in DB
        condition_group = DataConditionGroup.objects.get(id=detector.workflow_condition_group_id)
        assert condition_group.logic_type == DataConditionGroup.Type.ANY
        assert condition_group.organization_id == self.project.organization_id

        # Verify conditions in DB
        conditions = list(DataCondition.objects.filter(condition_group=condition_group))
        assert len(conditions) == 1
        condition = conditions[0]
        assert condition.type == "gte"
        assert condition.comparison == 100
        assert condition.condition_result == DetectorPriorityLevel.HIGH

        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=detector.id,
            event=audit_log.get_event_id("UPTIME_MONITOR_ADD"),
            data=detector.get_audit_log_data(),
        )

    def test_validate_detector_type_unknown(self):
        validator = MockDetectorValidator(data={**self.valid_data, "detectorType": "unknown_type"})
        assert not validator.is_valid()
        assert validator.errors.get("detectorType") == [
            ErrorDetail(string="Unknown detector type", code="invalid")
        ], validator.errors

    def test_validate_detector_type_incompatible(self):
        with mock.patch("sentry.issues.grouptype.registry.get_by_slug") as mock_get:
            mock_get.return_value = mock.Mock(detector_validator=None)
            validator = MockDetectorValidator(
                data={**self.valid_data, "detectorType": "incompatible_type"}
            )
            assert not validator.is_valid()
            assert validator.errors.get("detectorType") == [
                ErrorDetail(string="Detector type not compatible with detectors", code="invalid")
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
            "detectorType": MetricAlertFire.slug,
            "dataSources": [
                {
                    "query_type": SnubaQuery.Type.ERROR.value,
                    "dataset": Dataset.Events.value,
                    "query": "test query",
                    "aggregate": "count()",
                    "time_window": 60,
                    "environment": self.environment.name,
                    "event_types": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                },
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
                ],
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
        assert detector.type == MetricAlertFire.slug
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
            event=audit_log.get_event_id("UPTIME_MONITOR_ADD"),
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


class SnubaQueryValidatorTest(TestCase):
    def setUp(self):
        self.valid_data = {
            "queryType": SnubaQuery.Type.ERROR.value,
            "dataset": Dataset.Events.value,
            "query": "test query",
            "aggregate": "count()",
            "timeWindow": 60,
            "environment": self.environment.name,
            "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
        }
        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }

    def test_simple(self):
        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid()
        assert validator.validated_data["query_type"] == SnubaQuery.Type.ERROR
        assert validator.validated_data["dataset"] == Dataset.Events
        assert validator.validated_data["query"] == "test query"
        assert validator.validated_data["aggregate"] == "count()"
        assert validator.validated_data["time_window"] == 60
        assert validator.validated_data["environment"] == self.environment
        assert validator.validated_data["event_types"] == [SnubaQueryEventType.EventType.ERROR]
        assert isinstance(validator.validated_data["_creator"], DataSourceCreator)

    def test_invalid_query(self):
        unsupported_query = "release:latest"
        self.valid_data["query"] = unsupported_query
        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("query") == [
            ErrorDetail(
                string=f"Unsupported Query: We do not currently support the {unsupported_query} query",
                code="invalid",
            )
        ]

    def test_invalid_query_type(self):
        invalid_query_type = 666
        self.valid_data["queryType"] = invalid_query_type
        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("queryType") == [
            ErrorDetail(string=f"Invalid query type {invalid_query_type}", code="invalid")
        ]


class MockModel(Model):
    __relocation_scope__ = RelocationScope.Excluded

    class Meta:
        app_label = "fixtures"


class TestDataSourceCreator(TestCase):
    def test_create_calls_once(self):
        mock_instance = MockModel()
        mock_fn = mock.Mock(return_value=mock_instance)
        creator = DataSourceCreator(create_fn=mock_fn)

        result1 = creator.create()
        assert result1 == mock_instance
        mock_fn.assert_called_once()

        result2 = creator.create()
        assert result2 == mock_instance
        mock_fn.assert_called_once()


class MockDataSourceValidator(BaseDataSourceValidator[MockModel]):
    field1 = serializers.CharField()
    field2 = serializers.IntegerField()
    data_source_type_handler = QuerySubscriptionDataSourceHandler

    class Meta:
        model = MockModel
        fields = [
            "field1",
            "field2",
        ]

    def create_source(self, validated_data) -> MockModel:
        return MockModel.objects.create()


class TestBaseDataSourceValidator(TestCase):
    def test_validate_adds_creator_and_type(self):
        validator = MockDataSourceValidator(
            data={
                "field1": "test",
                "field2": 123,
            }
        )
        assert validator.is_valid()
        assert "_creator" in validator.validated_data
        assert isinstance(validator.validated_data["_creator"], DataSourceCreator)
        assert validator.validated_data["data_source_type"] == data_source_type_registry.get_key(
            QuerySubscriptionDataSourceHandler
        )


class MockDataConditionValidator(NumericComparisonConditionValidator):
    supported_conditions = frozenset([Condition.GREATER_OR_EQUAL, Condition.LESS_OR_EQUAL])
    supported_condition_results = frozenset([DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW])


class MockConditionGroupValidator(BaseDataConditionGroupValidator):
    conditions = MockDataConditionValidator(many=True)


class MockDetectorValidator(BaseDetectorTypeValidator):
    data_sources = MockDataSourceValidator(many=True)
    condition_group = MockConditionGroupValidator()
