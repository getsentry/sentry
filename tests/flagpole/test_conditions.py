from typing import Any

import pytest
from pydantic import ValidationError

from flagpole import EvaluationContext
from flagpole.conditions import (
    ConditionBase,
    ConditionOperatorKind,
    ConditionTypeMismatchException,
    ContainsCondition,
    EqualsCondition,
    InCondition,
    NotContainsCondition,
    NotEqualsCondition,
    NotInCondition,
    create_case_insensitive_set_from_list,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json


class TestCreateCaseInsensitiveSetFromList(TestCase):
    def test_empty_set(self):
        assert create_case_insensitive_set_from_list([]) == set()

    def test_returns_int_set(self):
        assert create_case_insensitive_set_from_list([1, 2, 3]) == {1, 2, 3}

    def test_returns_float_set(self):
        assert create_case_insensitive_set_from_list([1.1, 2.2, 3.3]) == {1.1, 2.2, 3.3}

    def test_returns_lowercase_string_set(self):
        assert create_case_insensitive_set_from_list(["AbC", "DEF"]) == {"abc", "def"}


def assert_valid_types(condition: type[ConditionBase], expected_types: list[Any]):
    for value in expected_types:
        operator_dict = dict(property="test", value=value)
        json_operator = json.dumps(operator_dict)
        try:
            parsed_operator = condition.parse_raw(json_operator)
        except ValidationError as exc:
            raise AssertionError(
                f"Expected value `{value}` to be a valid value for operator '{condition}'"
            ) from exc
        assert parsed_operator.value == value


def assert_invalid_types(condition: type[ConditionBase], invalid_types: list[Any]):
    for value in invalid_types:
        json_dict = dict(value=value)
        operator_json = json.dumps(json_dict)
        try:
            condition.parse_raw(operator_json)
        except ValidationError:
            continue

        raise AssertionError(
            f"Expected validation error for value: `{value}` for operator `{condition}`"
        )


class TestInConditions(TestCase):
    def test_invalid_values(self):
        with pytest.raises(ValidationError):
            InCondition(value="bar")

        with pytest.raises(ValidationError):
            InCondition(value=1234)

    def test_is_in(self):
        values = ["bar", "baz"]
        condition = InCondition(property="foo", kind=ConditionOperatorKind.IN, value=values)
        assert condition.match(context=EvaluationContext({"foo": "bar"}), segment_name="test")

        not_condition = NotInCondition(
            property="foo", kind=ConditionOperatorKind.NOT_IN, value=values
        )
        assert not not_condition.match(
            context=EvaluationContext({"foo": "bar"}), segment_name="test"
        )

        int_values = [1, 2]
        condition = InCondition(property="foo", kind=ConditionOperatorKind.IN, value=int_values)
        # Validation check to ensure no type coercion occurs
        assert condition.value == int_values
        assert condition.match(context=EvaluationContext({"foo": 2}), segment_name="test")
        assert not condition.match(context=EvaluationContext({"foo": 3}), segment_name="test")

    def test_is_in_numeric_string(self):
        values = ["123", "456"]
        condition = InCondition(property="foo", kind=ConditionOperatorKind.IN, value=values)
        assert condition.value == values
        assert not condition.match(context=EvaluationContext({"foo": 123}), segment_name="test")
        assert condition.match(context=EvaluationContext({"foo": "123"}), segment_name="test")

    def test_is_not_in(self):
        values = ["bar", "baz"]
        condition = InCondition(property="foo", kind=ConditionOperatorKind.IN, value=values)
        assert not condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_condition = NotInCondition(
            property="foo", kind=ConditionOperatorKind.NOT_IN, value=values
        )
        assert not_condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

    def test_is_in_case_insensitivity(self):
        values = ["bAr", "baz"]
        condition = InCondition(property="foo", kind=ConditionOperatorKind.IN, value=values)
        assert condition.match(context=EvaluationContext({"foo": "BaR"}), segment_name="test")

        not_condition = NotInCondition(
            property="foo", kind=ConditionOperatorKind.NOT_IN, value=values
        )
        assert not not_condition.match(
            context=EvaluationContext({"foo": "BaR"}), segment_name="test"
        )

    def test_invalid_property_value(self):
        values = ["bar", "baz"]
        condition = InCondition(property="foo", kind=ConditionOperatorKind.IN, value=values)

        with pytest.raises(ConditionTypeMismatchException):
            condition.match(context=EvaluationContext({"foo": []}), segment_name="test")

        not_condition = NotInCondition(
            property="foo", kind=ConditionOperatorKind.NOT_IN, value=values
        )
        with pytest.raises(ConditionTypeMismatchException):
            not_condition.match(context=EvaluationContext({"foo": []}), segment_name="test")

    def test_valid_json_and_reparse(self):
        values = [["foo", "bar"], [1, 2], [1.1, 2.2], []]
        assert_valid_types(condition=InCondition, expected_types=values)
        assert_valid_types(condition=NotInCondition, expected_types=values)

    def test_invalid_value_type_parsing(self):
        values = ["abc", 1, 2.2, True, None, ["a", 1], [True], [[]], [1, 2.2], [1.1, "2.2"]]
        assert_invalid_types(condition=InCondition, invalid_types=values)
        assert_invalid_types(condition=NotInCondition, invalid_types=values)


class TestContainsConditions(TestCase):
    def test_does_contain(self):
        operator = ContainsCondition(
            property="foo", kind=ConditionOperatorKind.CONTAINS, value="bar"
        )
        assert operator.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

        not_operator = NotContainsCondition(
            property="foo", kind=ConditionOperatorKind.NOT_CONTAINS, value="bar"
        )
        assert not not_operator.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

        operator = ContainsCondition(property="foo", kind=ConditionOperatorKind.CONTAINS, value=1)
        assert operator.match(context=EvaluationContext({"foo": [1, 2]}), segment_name="test")
        assert not operator.match(context=EvaluationContext({"foo": [3, 4]}), segment_name="test")

    def test_does_not_contain(self):
        values = "baz"
        operator = ContainsCondition(
            property="foo", kind=ConditionOperatorKind.CONTAINS, value=values
        )
        assert not operator.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

        not_operator = NotContainsCondition(
            property="foo", kind=ConditionOperatorKind.NOT_CONTAINS, value=values
        )
        assert not_operator.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

    def test_invalid_property_provided(self):
        values = "baz"

        with pytest.raises(ConditionTypeMismatchException):
            operator = ContainsCondition(
                property="foo", kind=ConditionOperatorKind.CONTAINS, value=values
            )
            assert not operator.match(
                context=EvaluationContext({"foo": "oops"}), segment_name="test"
            )

        with pytest.raises(ConditionTypeMismatchException):
            not_operator = NotContainsCondition(
                property="foo", kind=ConditionOperatorKind.NOT_CONTAINS, value=values
            )
            assert not_operator.match(
                context=EvaluationContext({"foo": "oops"}), segment_name="test"
            )

    def test_valid_json_parsing_with_types(self):
        values = [1, 2.2, "abc"]
        assert_valid_types(condition=ContainsCondition, expected_types=values)
        assert_valid_types(condition=NotContainsCondition, expected_types=values)

    def test_invalid_value_type_parsing(self):
        values: list[Any] = [
            None,
            [],
            dict(foo="bar"),
            [[]],
        ]
        assert_invalid_types(condition=ContainsCondition, invalid_types=values)
        assert_invalid_types(condition=NotContainsCondition, invalid_types=values)


class TestEqualsConditions(TestCase):
    def test_is_equal_string(self):
        value = "foo"
        operator = EqualsCondition(property="foo", kind=ConditionOperatorKind.EQUALS, value=value)
        assert operator.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_operator = NotEqualsCondition(
            property="foo", kind=ConditionOperatorKind.NOT_EQUALS, value=value
        )
        assert not not_operator.match(
            context=EvaluationContext({"foo": "foo"}), segment_name="test"
        )

    def test_is_not_equals(self):
        values = "bar"
        operator = EqualsCondition(property="foo", kind=ConditionOperatorKind.EQUALS, value=values)
        assert not operator.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_operator = NotEqualsCondition(
            property="foo", kind=ConditionOperatorKind.NOT_EQUALS, value=values
        )
        assert not_operator.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

    def test_is_equal_case_insensitive(self):
        values = "bAr"
        operator = EqualsCondition(property="foo", kind=ConditionOperatorKind.EQUALS, value=values)
        assert operator.match(context=EvaluationContext({"foo": "BaR"}), segment_name="test")

        not_operator = NotEqualsCondition(
            property="foo", kind=ConditionOperatorKind.NOT_EQUALS, value=values
        )
        assert not not_operator.match(
            context=EvaluationContext({"foo": "BaR"}), segment_name="test"
        )

    def test_equality_type_mismatch_strings(self):
        values = ["foo", "bar"]
        operator = EqualsCondition(property="foo", kind=ConditionOperatorKind.EQUALS, value=values)

        with pytest.raises(ConditionTypeMismatchException):
            operator.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_operator = NotEqualsCondition(
            property="foo", kind=ConditionOperatorKind.NOT_EQUALS, value=values
        )
        with pytest.raises(ConditionTypeMismatchException):
            not_operator.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

    def test_valid_json_parsing_with_types(self):
        values = [1, 2.2, "abc", True, False, [], ["foo"], [1], [1.1]]
        assert_valid_types(condition=EqualsCondition, expected_types=values)
        assert_valid_types(condition=NotEqualsCondition, expected_types=values)

    def test_invalid_value_type_parsing(self):
        values = [None, dict(foo="bar")]
        assert_invalid_types(condition=EqualsCondition, invalid_types=values)
        assert_invalid_types(condition=NotEqualsCondition, invalid_types=values)
