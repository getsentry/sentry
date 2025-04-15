from unittest import mock

import pytest
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail, ValidationError

from sentry import audit_log
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.metric_alert_detector import (
    MetricAlertComparisonConditionValidator,
    MetricAlertsDetectorValidator,
)
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.snuba.models import QuerySubscriptionDataSourceHandler
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import (
    BaseDataConditionGroupValidator,
    BaseDataSourceValidator,
    BaseDetectorTypeValidator,
    DataSourceCreator,
)
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, DataSource
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DetectorPriorityLevel, DetectorSettings
from tests.sentry.workflow_engine.test_base import MockModel


class BaseValidatorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.data_condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )


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


class MockDataConditionValidator(MetricAlertComparisonConditionValidator):
    supported_conditions = frozenset([Condition.GREATER_OR_EQUAL, Condition.LESS_OR_EQUAL])
    supported_condition_results = frozenset([DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW])


class MockConditionGroupValidator(BaseDataConditionGroupValidator):
    conditions = serializers.ListField(required=True)

    def validate_conditions(self, value) -> list:
        for condition in value:
            MockDataConditionValidator(data=condition).is_valid(raise_exception=True)

        return value


class MockDetectorValidator(BaseDetectorTypeValidator):
    data_source = MockDataSourceValidator()
    condition_group = MockConditionGroupValidator()


# TODO - see if we can refactor and mock the grouptype / grouptype.registry
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
                detector_settings=DetectorSettings(validator=MetricAlertsDetectorValidator),
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
            )
            validator = self.validator_class()
            with pytest.raises(
                ValidationError,
                match="[ErrorDetail(string='Detector type not compatible with detectors', code='invalid')]",
            ):
                validator.validate_detector_type("test_type")


# TODO - Move these tests into a base detector test file
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
            "dataSource": {
                "field1": "test",
                "field2": 123,
            },
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

    # TODO - Refactor into multiple tests - basically where there are comment blocks
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
            event=audit_log.get_event_id("DETECTOR_ADD"),
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
            mock_get.return_value = mock.Mock(detector_settings=None)
            validator = MockDetectorValidator(
                data={**self.valid_data, "detectorType": "incompatible_type"}
            )
            assert not validator.is_valid()
            assert validator.errors.get("detectorType") == [
                ErrorDetail(string="Detector type not compatible with detectors", code="invalid")
            ]
