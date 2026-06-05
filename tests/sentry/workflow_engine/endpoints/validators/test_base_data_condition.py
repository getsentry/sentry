from typing import Any
from unittest import mock

from rest_framework.serializers import ValidationError

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import (
    AbstractDataConditionValidator,
    BaseDataConditionValidator,
)
from sentry.workflow_engine.models import Condition
from sentry.workflow_engine.types import DataConditionHandler


class MockDataConditionHandler(DataConditionHandler[dict[str, str]]):
    comparison_json_schema = {"type": "number"}
    condition_result_schema = {"type": "boolean"}


@mock.patch(
    "sentry.workflow_engine.registry.condition_handler_registry.get",
    return_value=MockDataConditionHandler,
)
class TestBaseDataConditionValidator(TestCase):
    def setUp(self) -> None:
        self.condition_group = self.create_data_condition_group()
        self.valid_data = {
            "type": Condition.EVENT_ATTRIBUTE,
            "comparison": 1,
            "conditionResult": True,
            "conditionGroupId": self.condition_group.id,
        }

    def test_conditions__valid_condition(self, mock_handler_get: mock.MagicMock) -> None:
        validator = BaseDataConditionValidator(data=self.valid_data)
        assert validator.is_valid() is True

    def test_conditions__no_type(self, mock_handler_get: mock.MagicMock) -> None:
        invalid_data = {"comparison": 0}
        validator = BaseDataConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_conditions__invalid_condition_type(self, mock_handler_get: mock.MagicMock) -> None:
        invalid_data = {**self.valid_data, "type": "invalid-type"}
        validator = BaseDataConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_comparison__no_comparison(self, mock_handler_get: mock.MagicMock) -> None:
        invalid_data = {"type": Condition.EQUAL}
        validator = BaseDataConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_comparison__primitive_value(self, mock_handler_get: mock.MagicMock) -> None:
        valid_data = {**self.valid_data, "comparison": 1}
        validator = BaseDataConditionValidator(data=valid_data)
        assert validator.is_valid() is True


class MockComplexDataConditionHandler(DataConditionHandler[dict[str, Any]]):
    comparison_json_schema = {
        "type": "object",
        "properties": {
            "foo": {
                "type": ["string"],
            },
        },
        "required": ["foo"],
        "additionalProperties": False,
    }

    condition_result_schema = {
        "type": "object",
        "properties": {
            "bar": {
                "type": ["string"],
            },
        },
        "required": ["bar"],
        "additionalProperties": False,
    }


@mock.patch(
    "sentry.workflow_engine.registry.condition_handler_registry.get",
    return_value=MockComplexDataConditionHandler,
)
class TestComplexBaseDataConditionValidator(TestCase):
    def setUp(self) -> None:
        self.condition_group = self.create_data_condition_group()
        self.valid_data = {
            "field1": "test",
            "type": Condition.EVENT_ATTRIBUTE,
            "comparison": 1,
            "conditionResult": {"bar": "baz"},
            "conditionGroupId": self.condition_group.id,
        }

    def test_comparison__complex_value(self, mock_handler_get: mock.MagicMock) -> None:
        valid_data = {
            **self.valid_data,
            "comparison": {"foo": "bar"},
        }
        validator = BaseDataConditionValidator(data=valid_data)
        assert validator.is_valid() is True

    def test_comparison__complex_value__invalid(self, mock_handler_get: mock.MagicMock) -> None:
        valid_data = {
            **self.valid_data,
            "comparison": {"invalid": "value"},
        }
        validator = BaseDataConditionValidator(data=valid_data)
        assert validator.is_valid() is False

    def test_condition_result__complex_value__dict(self, mock_handler_get: mock.MagicMock) -> None:
        validator = BaseDataConditionValidator(data=self.valid_data)
        assert validator.is_valid() is False

    def test_condition_result__complex_value__array(self, mock_handler_get: mock.MagicMock) -> None:
        invalid_data = {**self.valid_data, "conditionResult": ["foo"]}
        validator = BaseDataConditionValidator(data=invalid_data)
        assert validator.is_valid() is False


class TestAssignedToScopeValidator(TestCase):
    def setUp(self) -> None:
        self.other_org = self.create_organization()
        self.other_team = self.create_team(organization=self.other_org)
        self.other_user = self.create_user()
        self.create_member(organization=self.other_org, user=self.other_user)

    def _validator(self, comparison: dict[str, Any]) -> BaseDataConditionValidator:
        return BaseDataConditionValidator(
            data={
                "type": Condition.ASSIGNED_TO.value,
                "comparison": comparison,
                "conditionResult": True,
            },
            context={"organization": self.organization},
        )

    def test_team__in_org(self) -> None:
        validator = self._validator({"targetType": "Team", "targetIdentifier": self.team.id})
        assert validator.is_valid() is True

    def test_team__foreign_org(self) -> None:
        validator = self._validator({"targetType": "Team", "targetIdentifier": self.other_team.id})
        assert validator.is_valid() is False
        assert "not part of the organization" in str(validator.errors).lower()

    def test_member__in_org(self) -> None:
        validator = self._validator({"targetType": "Member", "targetIdentifier": self.user.id})
        assert validator.is_valid() is True

    def test_member__foreign_org(self) -> None:
        validator = self._validator(
            {"targetType": "Member", "targetIdentifier": self.other_user.id}
        )
        assert validator.is_valid() is False
        assert "not part of the organization" in str(validator.errors).lower()

    def test_unassigned__no_identifier(self) -> None:
        validator = self._validator({"targetType": "Unassigned"})
        assert validator.is_valid() is True

    def test_non_integer_identifier(self) -> None:
        validator = self._validator({"targetType": "Team", "targetIdentifier": "not-an-int"})
        assert validator.is_valid() is False

    def test_no_organization_context(self) -> None:
        # Without org context the scope check is skipped (schema-only validation).
        validator = BaseDataConditionValidator(
            data={
                "type": Condition.ASSIGNED_TO.value,
                "comparison": {"targetType": "Team", "targetIdentifier": self.other_team.id},
                "conditionResult": True,
            },
        )
        assert validator.is_valid() is True


class ExampleConditionValidator(AbstractDataConditionValidator[int, bool]):
    def validate_comparison(self, value: Any) -> int:
        if isinstance(value, int):
            return value
        else:
            raise ValidationError("Comparison must be an integer")

    def validate_condition_result(self, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        else:
            raise ValidationError("Condition result must be a boolean")


class TestAbstractConditionValidator(TestCase):
    def setUp(self) -> None:
        self.condition_group = self.create_data_condition_group()
        self.valid_data = {
            "type": Condition.EQUAL,
            "comparison": 1,
            "conditionResult": True,
            "conditionGroupId": self.condition_group.id,
        }

    def test_validate_comparison(self) -> None:
        validator = ExampleConditionValidator(data=self.valid_data)
        assert validator.is_valid() is True

    def test_validate_condition_result(self) -> None:
        validator = ExampleConditionValidator(data=self.valid_data)
        assert validator.is_valid() is True

    def test_validate_comparison__invalid(self) -> None:
        invalid_data = {**self.valid_data, "comparison": "invalid"}
        validator = ExampleConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_validate_condition_result__invalid(self) -> None:
        invalid_data = {**self.valid_data, "conditionResult": "invalid"}
        validator = ExampleConditionValidator(data=invalid_data)
        assert validator.is_valid() is False
