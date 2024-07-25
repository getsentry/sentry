from typing import Any

import orjson
import pytest
from pydantic import ValidationError

from flagpole import EvaluationContext
from flagpole.conditions import (
    ConditionBase,
    ConditionTypeMismatchException,
    ContainsCondition,
    EqualsCondition,
    InCondition,
    NotContainsCondition,
    NotEqualsCondition,
    NotInCondition,
    create_case_insensitive_set_from_list,
)


class TestCreateCaseInsensitiveSetFromList:
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
        condition_dict = dict(property="test", value=value)
        json_condition = orjson.dumps(condition_dict)
        try:
            parsed_condition = condition.parse_raw(json_condition)
        except ValidationError as exc:
            raise AssertionError(
                f"Expected value `{value}` to be a valid value for condition '{condition}'"
            ) from exc
        assert parsed_condition.value == value


def assert_invalid_types(condition: type[ConditionBase], invalid_types: list[Any]):
    for value in invalid_types:
        json_dict = dict(value=value)
        condition_json = orjson.dumps(json_dict)
        try:
            condition.parse_raw(condition_json)
        except ValidationError:
            continue

        raise AssertionError(
            f"Expected validation error for value: `{value}` for condition `{condition}`"
        )


class TestInConditions:
    def test_invalid_values(self):
        with pytest.raises(ValidationError):
            InCondition(property="foo", value="bar")

        with pytest.raises(ValidationError):
            InCondition(property="foo", value=1234)

    def test_is_in(self):
        values = ["bar", "baz"]
        condition = InCondition(property="foo", value=values)
        assert condition.match(context=EvaluationContext({"foo": "bar"}), segment_name="test")

        not_condition = NotInCondition(property="foo", value=values)
        assert not not_condition.match(
            context=EvaluationContext({"foo": "bar"}), segment_name="test"
        )

        int_values = [1, 2]
        condition = InCondition(property="foo", value=int_values)
        # Validation check to ensure no type coercion occurs
        assert condition.value == int_values
        assert condition.match(context=EvaluationContext({"foo": 2}), segment_name="test")
        assert not condition.match(context=EvaluationContext({"foo": 3}), segment_name="test")

    def test_is_in_numeric_string(self):
        values = ["123", "456"]
        condition = InCondition(property="foo", value=values)
        assert condition.value == values
        assert not condition.match(context=EvaluationContext({"foo": 123}), segment_name="test")
        assert condition.match(context=EvaluationContext({"foo": "123"}), segment_name="test")

    def test_is_not_in(self):
        values = ["bar", "baz"]
        condition = InCondition(property="foo", value=values)
        assert not condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_condition = NotInCondition(property="foo", value=values)
        assert not_condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

    def test_is_in_case_insensitivity(self):
        values = ["bAr", "baz"]
        condition = InCondition(property="foo", value=values)
        assert condition.match(context=EvaluationContext({"foo": "BaR"}), segment_name="test")

        not_condition = NotInCondition(property="foo", value=values)
        assert not not_condition.match(
            context=EvaluationContext({"foo": "BaR"}), segment_name="test"
        )

    def test_invalid_property_value(self):
        values = ["bar", "baz"]
        condition = InCondition(property="foo", value=values)

        with pytest.raises(ConditionTypeMismatchException):
            condition.match(context=EvaluationContext({"foo": []}), segment_name="test")

        not_condition = NotInCondition(property="foo", value=values)
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

    def test_missing_context_property(self):
        values = ["bar", "baz"]
        in_condition = InCondition(property="foo", value=values)
        assert not in_condition.match(
            context=EvaluationContext({"bar": "bar"}), segment_name="test"
        )

        not_on_condition = NotInCondition(property="foo", value=values)
        assert not_on_condition.match(
            context=EvaluationContext({"bar": "bar"}), segment_name="test"
        )


class TestContainsConditions:
    def test_does_contain(self):
        condition = ContainsCondition(property="foo", value="bar")
        assert condition.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

        not_condition = NotContainsCondition(property="foo", value="bar")
        assert not not_condition.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

        condition = ContainsCondition(property="foo", value=1)
        assert condition.match(context=EvaluationContext({"foo": [1, 2]}), segment_name="test")
        assert not condition.match(context=EvaluationContext({"foo": [3, 4]}), segment_name="test")

    def test_does_not_contain(self):
        values = "baz"
        condition = ContainsCondition(property="foo", value=values)
        assert not condition.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

        not_condition = NotContainsCondition(property="foo", value=values)
        assert not_condition.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

    def test_invalid_property_provided(self):
        values = "baz"

        with pytest.raises(ConditionTypeMismatchException):
            condition = ContainsCondition(property="foo", value=values)
            assert not condition.match(
                context=EvaluationContext({"foo": "oops"}), segment_name="test"
            )

        with pytest.raises(ConditionTypeMismatchException):
            not_condition = NotContainsCondition(property="foo", value=values)
            assert not_condition.match(
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

    def test_missing_context_property(self):
        condition = ContainsCondition(property="foo", value="bar")

        with pytest.raises(ConditionTypeMismatchException):
            condition.match(context=EvaluationContext({"bar": ["foo", "bar"]}), segment_name="test")

        not_condition = NotContainsCondition(property="foo", value="bar")

        with pytest.raises(ConditionTypeMismatchException):
            not_condition.match(
                context=EvaluationContext({"bar": ["foo", "bar"]}), segment_name="test"
            )


class TestEqualsConditions:
    def test_is_equal_string(self):
        value = "foo"
        condition = EqualsCondition(property="foo", value=value)
        assert condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_condition = NotEqualsCondition(property="foo", value=value)
        assert not not_condition.match(
            context=EvaluationContext({"foo": "foo"}), segment_name="test"
        )

    def test_is_not_equals(self):
        values = "bar"
        condition = EqualsCondition(property="foo", value=values)
        assert not condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_condition = NotEqualsCondition(property="foo", value=values)
        assert not_condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

    def test_is_equal_case_insensitive(self):
        values = "bAr"
        condition = EqualsCondition(property="foo", value=values)
        assert condition.match(context=EvaluationContext({"foo": "BaR"}), segment_name="test")

        not_condition = NotEqualsCondition(property="foo", value=values)
        assert not not_condition.match(
            context=EvaluationContext({"foo": "BaR"}), segment_name="test"
        )

    def test_equality_type_mismatch_strings(self):
        values = ["foo", "bar"]
        condition = EqualsCondition(property="foo", value=values)

        with pytest.raises(ConditionTypeMismatchException):
            condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_condition = NotEqualsCondition(property="foo", value=values)
        with pytest.raises(ConditionTypeMismatchException):
            not_condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

    def test_valid_json_parsing_with_types(self):
        values = [1, 2.2, "abc", True, False, [], ["foo"], [1], [1.1]]
        assert_valid_types(condition=EqualsCondition, expected_types=values)
        assert_valid_types(condition=NotEqualsCondition, expected_types=values)

    def test_invalid_value_type_parsing(self):
        values = [None, dict(foo="bar")]
        assert_invalid_types(condition=EqualsCondition, invalid_types=values)
        assert_invalid_types(condition=NotEqualsCondition, invalid_types=values)

    def test_with_missing_context_property(self):
        value = "foo"
        condition = EqualsCondition(property="foo", value=value, strict_validation=True)

        with pytest.raises(ConditionTypeMismatchException):
            condition.match(context=EvaluationContext({"bar": value}), segment_name="test")

        not_condition = NotEqualsCondition(property="foo", value=value, strict_validation=True)

        with pytest.raises(ConditionTypeMismatchException):
            not_condition.match(context=EvaluationContext({"bar": value}), segment_name="test")

        # Test non-strict validation for both conditions
        condition = EqualsCondition(property="foo", value=value)
        assert (
            condition.match(context=EvaluationContext({"bar": value}), segment_name="test") is False
        )

        not_condition = NotEqualsCondition(property="foo", value=value)
        assert (
            not_condition.match(context=EvaluationContext({"bar": value}), segment_name="test")
            is True
        )
