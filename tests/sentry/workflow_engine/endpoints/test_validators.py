from unittest import mock

import pytest
from rest_framework.exceptions import ErrorDetail, ValidationError

from sentry.incidents.endpoints.validators import (
    MetricAlertComparisonConditionValidator,
    MetricAlertsDetectorValidator,
)
from sentry.incidents.grouptype import MetricAlertFire
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators import (
    BaseGroupTypeDetectorValidator,
    NumericComparisonConditionValidator,
)
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.utils.test_audit import fake_http_request


class TestNumericComparisonConditionValidator(TestCase):
    def setUp(self):
        super().setUp()

        # Create a concrete implementation for testing
        class ConcreteNumericValidator(NumericComparisonConditionValidator):
            @property
            def supported_conditions(self):
                return frozenset([Condition.GREATER, Condition.LESS])

            @property
            def supported_results(self):
                return frozenset([DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW])

        self.validator_class = ConcreteNumericValidator

    def test_validate_condition_valid(self):
        validator = self.validator_class()
        assert validator.validate_condition("gt") == Condition.GREATER

    def test_validate_condition_invalid(self):
        validator = self.validator_class()
        with pytest.raises(
            ValidationError,
            match="[ErrorDetail(string='Unsupported condition invalid_condition', code='invalid')]",
        ):
            validator.validate_condition("invalid_condition")

    def test_validate_result_valid(self):
        validator = self.validator_class()
        assert validator.validate_result("75") == DetectorPriorityLevel.HIGH

    def test_validate_result_invalid(self):
        validator = self.validator_class()
        with pytest.raises(
            ValidationError,
            match="[ErrorDetail(string='Unsupported condition result', code='invalid')]",
        ):
            validator.validate_result("invalid_result")


class TestBaseGroupTypeDetectorValidator(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()

        # Create a concrete implementation for testing
        class ConcreteGroupTypeValidator(BaseGroupTypeDetectorValidator):
            @property
            def data_source(self):
                return mock.Mock()

            @property
            def data_conditions(self):
                return mock.Mock()

        self.validator_class = ConcreteGroupTypeValidator

    def test_validate_group_type_valid(self):
        with mock.patch.object(grouptype.registry, "get_by_slug") as mock_get_by_slug:
            mock_get_by_slug.return_value = GroupType(
                type_id=1,
                slug="test_type",
                description="no handler",
                category=GroupCategory.METRIC_ALERT.value,
                detector_validator=MetricAlertsDetectorValidator,
            )
            validator = self.validator_class()
            result = validator.validate_group_type("test_type")
            assert result == mock_get_by_slug.return_value

    def test_validate_group_type_unknown(self):
        with mock.patch.object(grouptype.registry, "get_by_slug", return_value=None):
            validator = self.validator_class()
            with pytest.raises(
                ValidationError, match="[ErrorDetail(string='Unknown group type', code='invalid')]"
            ):
                validator.validate_group_type("unknown_type")

    def test_validate_group_type_incompatible(self):
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
                match="[ErrorDetail(string='Group type not compatible with detectors', code='invalid')]",
            ):
                validator.validate_group_type("test_type")


class MetricAlertComparisonConditionValidatorTest(TestCase):
    def test(self):
        validator = MetricAlertComparisonConditionValidator(
            data={"condition": "gt", "comparison": 100, "result": DetectorPriorityLevel.HIGH}
        )
        assert validator.is_valid()
        assert validator.validated_data == {
            "comparison": 100.0,
            "condition": Condition.GREATER,
            "result": DetectorPriorityLevel.HIGH,
            "type": "metric_alert",
        }

    def test_invalid_condition(self):
        validator = MetricAlertComparisonConditionValidator(
            data={"condition": "invalid", "comparison": 100, "result": DetectorPriorityLevel.HIGH}
        )
        assert not validator.is_valid()
        assert validator.errors.get("condition") == [
            ErrorDetail(string="Unsupported condition invalid", code="invalid")
        ]

    def test_invalid_comparison(self):
        validator = MetricAlertComparisonConditionValidator(
            data={
                "condition": "gt",
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
            data={"condition": "gt", "comparison": 100, "result": 25}
        )
        assert not validator.is_valid()
        assert validator.errors.get("result") == [
            ErrorDetail(string="Unsupported condition result", code="invalid")
        ]


class DetectorValidatorTest(TestCase):
    def test(self):
        conditions = [{"condition": "gt", "comparison": 100, "result": DetectorPriorityLevel.HIGH}]
        group_type = MetricAlertFire
        data = {
            "name": "test",
            "group_type": group_type.slug,
            "data_source": {},
            "data_conditions": conditions,
        }
        validator = MetricAlertsDetectorValidator(
            context={"request": fake_http_request(self.user), "project": self.project},
            data=data,
        )
        assert validator.is_valid(), validator.errors
        detector = validator.save()
        assert detector.organization == self.project.organization
        assert detector.name == "test"
        assert detector.type == group_type.slug
        assert list(detector.data_sources.all()) == []
        assert detector.workflow_condition_group.logic_type == DataConditionGroup.Type.ANY
        assert detector.workflow_condition_group.organization == self.project.organization
        assert [
            {
                "condition": c.condition,
                "comparison": c.comparison,
                "result": c.condition_result,
                "type": c.type,
            }
            for c in detector.workflow_condition_group.datacondition_set.all()
        ] == [{"type": MetricAlertComparisonConditionValidator.type, **c} for c in conditions]

    def test_invalid_group_type(self):
        conditions = [{"condition": "gt", "comparison": 100, "result": DetectorPriorityLevel.HIGH}]
        data = {
            "name": "test",
            "group_type": "invalid_group_type",
            "data_source": {},
            "data_conditions": conditions,
        }
        validator = MetricAlertsDetectorValidator(
            context={"request": fake_http_request(self.user), "project": self.project},
            data=data,
        )
        assert not validator.is_valid()
        assert "groupType" in validator.errors

    def test_too_many_conditions(self):
        data = {
            "name": "test",
            "group_type": MetricAlertFire.slug,
            "data_source": {},
            "data_conditions": [
                {"condition": "gt", "comparison": 100, "result": DetectorPriorityLevel.HIGH},
                {"condition": "gt", "comparison": 200, "result": DetectorPriorityLevel.HIGH},
                {"condition": "gt", "comparison": 300, "result": DetectorPriorityLevel.HIGH},
            ],
        }
        validator = MetricAlertsDetectorValidator(
            context={"request": fake_http_request(self.user), "project": self.project},
            data=data,
        )
        assert not validator.is_valid()
        assert validator.errors.get("nonFieldErrors") == [
            ErrorDetail(string="Too many conditions", code="invalid")
        ]

    def test_invalid_condition_format(self):
        data = {
            "name": "test",
            "group_type": MetricAlertFire.slug,
            "data_source": {},
            "data_conditions": [{"invalid": "format"}],
        }
        validator = MetricAlertsDetectorValidator(
            context={"request": fake_http_request(self.user), "project": self.project},
            data=data,
        )
        assert not validator.is_valid()
        assert validator.errors.get("dataConditions") == [
            {
                "condition": [ErrorDetail(string="This field is required.", code="required")],
                "comparison": [ErrorDetail(string="This field is required.", code="required")],
                "result": [ErrorDetail(string="This field is required.", code="required")],
            }
        ]

    def test_invalid_name(self):
        data = {
            "group_type": MetricAlertFire.slug,
            "data_source": {},
            "data_conditions": [
                {"condition": "gt", "comparison": 100, "result": DetectorPriorityLevel.HIGH}
            ],
        }
        validator = MetricAlertsDetectorValidator(
            context={"request": fake_http_request(self.user), "project": self.project},
            data=data,
        )
        assert not validator.is_valid()
        assert validator.errors.get("name") == [
            ErrorDetail(string="This field is required.", code="required")
        ]
