from typing import Any

import pytest
from pydantic import ValidationError

from flagpole.operators import (
    ConditionTypeMismatchException,
    ContainsOperator,
    EqualsOperator,
    InOperator,
    NotContainsOperator,
    NotEqualsOperator,
    NotInOperator,
    Operator,
    OperatorKind,
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


def assert_valid_types(operator: type[Operator], expected_types: list[Any]):
    for value in expected_types:
        operator_dict = dict(value=value)
        json_operator = json.dumps(operator_dict)
        try:
            parsed_operator = operator.parse_raw(json_operator)
        except ValidationError as exc:
            raise AssertionError(
                f"Expected value `{value}` to be a valid value for operator '{operator}'"
            ) from exc
        assert parsed_operator.value == value


def assert_invalid_types(operator: type[Operator], invalid_types: list[Any]):
    for value in invalid_types:
        json_dict = dict(value=value)
        operator_json = json.dumps(json_dict)
        try:
            operator.parse_raw(operator_json)
        except ValidationError:
            continue

        raise AssertionError(
            f"Expected validation error for value: `{value}` for operator `{operator}`"
        )


class TestInOperators(TestCase):
    def test_invalid_values(self):
        with pytest.raises(ValidationError):
            InOperator(value="bar")

        with pytest.raises(ValidationError):
            InOperator(value=1234)

    def test_is_in(self):
        values = ["bar", "baz"]
        operator = InOperator(kind=OperatorKind.IN, value=values)
        assert operator.match(condition_property="bar", segment_name="test")

        not_operator = NotInOperator(kind=OperatorKind.NOT_IN, value=values)
        assert not not_operator.match(condition_property="bar", segment_name="test")

        int_values = [1, 2]
        operator = InOperator(kind=OperatorKind.IN, value=int_values)
        # Validation check to ensure no type coercion occurs
        assert operator.value == int_values
        assert operator.match(condition_property=2, segment_name="test")
        assert not operator.match(condition_property=3, segment_name="test")

    def test_is_in_numeric_string(self):
        values = ["123", "456"]
        operator = InOperator(kind=OperatorKind.IN, value=values)
        assert operator.value == values
        assert not operator.match(condition_property=123, segment_name="test")
        assert operator.match(condition_property="123", segment_name="test")

    def test_is_not_in(self):
        values = ["bar", "baz"]
        operator = InOperator(kind=OperatorKind.IN, value=values)
        assert not operator.match(condition_property="foo", segment_name="test")

        not_operator = NotInOperator(kind=OperatorKind.NOT_IN, value=values)
        assert not_operator.match(condition_property="foo", segment_name="test")

    def test_is_in_case_insensitivity(self):
        values = ["bAr", "baz"]
        operator = InOperator(kind=OperatorKind.IN, value=values)
        assert operator.match(condition_property="BaR", segment_name="test")

        not_operator = NotInOperator(kind=OperatorKind.NOT_IN, value=values)
        assert not not_operator.match(condition_property="BaR", segment_name="test")

    def test_invalid_property_value(self):
        values = ["bar", "baz"]
        operator = InOperator(kind=OperatorKind.IN, value=values)

        with pytest.raises(ConditionTypeMismatchException):
            operator.match(condition_property=[], segment_name="test")

        not_operator = NotInOperator(kind=OperatorKind.NOT_IN, value=values)
        with pytest.raises(ConditionTypeMismatchException):
            not_operator.match(condition_property=[], segment_name="test")

    def test_valid_json_and_reparse(self):
        values = [["foo", "bar"], [1, 2], [1.1, 2.2], []]
        assert_valid_types(operator=InOperator, expected_types=values)
        assert_valid_types(operator=NotInOperator, expected_types=values)

    def test_invalid_value_type_parsing(self):
        values = ["abc", 1, 2.2, True, None, ["a", 1], [True], [[]], [1, 2.2], [1.1, "2.2"]]
        assert_invalid_types(operator=InOperator, invalid_types=values)
        assert_invalid_types(operator=NotInOperator, invalid_types=values)


class TestContainsOperators(TestCase):
    def test_does_contain(self):
        operator = ContainsOperator(kind=OperatorKind.CONTAINS, value="bar")
        assert operator.match(condition_property=["foo", "bar"], segment_name="test")

        not_operator = NotContainsOperator(kind=OperatorKind.NOT_CONTAINS, value="bar")
        assert not not_operator.match(condition_property=["foo", "bar"], segment_name="test")

        operator = ContainsOperator(kind=OperatorKind.CONTAINS, value=1)
        assert operator.match(condition_property=[1, 2], segment_name="test")
        assert not operator.match(condition_property=[3, 4], segment_name="test")

    def test_does_not_contain(self):
        values = "baz"
        operator = ContainsOperator(kind=OperatorKind.CONTAINS, value=values)
        assert not operator.match(condition_property=["foo", "bar"], segment_name="test")

        not_operator = NotContainsOperator(kind=OperatorKind.NOT_CONTAINS, value=values)
        assert not_operator.match(condition_property=["foo", "bar"], segment_name="test")

    def test_invalid_property_provided(self):
        values = "baz"

        with pytest.raises(ConditionTypeMismatchException):
            operator = ContainsOperator(kind=OperatorKind.CONTAINS, value=values)
            assert not operator.match(condition_property="oops", segment_name="test")

        with pytest.raises(ConditionTypeMismatchException):
            not_operator = NotContainsOperator(kind=OperatorKind.NOT_CONTAINS, value=values)
            assert not_operator.match(condition_property="oops", segment_name="test")

    def test_valid_json_parsing_with_types(self):
        values = [1, 2.2, "abc"]
        assert_valid_types(operator=ContainsOperator, expected_types=values)
        assert_valid_types(operator=NotContainsOperator, expected_types=values)

    def test_invalid_value_type_parsing(self):
        values: list[Any] = [
            None,
            [],
            dict(foo="bar"),
            [[]],
        ]
        assert_invalid_types(operator=ContainsOperator, invalid_types=values)
        assert_invalid_types(operator=NotContainsOperator, invalid_types=values)


class TestEqualsOperators(TestCase):
    def test_is_equal_string(self):
        value = "foo"
        operator = EqualsOperator(kind=OperatorKind.EQUALS, value=value)
        assert operator.match(condition_property="foo", segment_name="test")

        not_operator = NotEqualsOperator(kind=OperatorKind.NOT_EQUALS, value=value)
        assert not not_operator.match(condition_property="foo", segment_name="test")

    def test_is_not_equals(self):
        values = "bar"
        operator = EqualsOperator(kind=OperatorKind.EQUALS, value=values)
        assert not operator.match(condition_property="foo", segment_name="test")

        not_operator = NotEqualsOperator(kind=OperatorKind.NOT_EQUALS, value=values)
        assert not_operator.match(condition_property="foo", segment_name="test")

    def test_is_equal_case_insensitive(self):
        values = "bAr"
        operator = EqualsOperator(kind=OperatorKind.EQUALS, value=values)
        assert operator.match(condition_property="BaR", segment_name="test")

        not_operator = NotEqualsOperator(kind=OperatorKind.NOT_EQUALS, value=values)
        assert not not_operator.match(condition_property="BaR", segment_name="test")

    def test_equality_type_mismatch_strings(self):
        values = ["foo", "bar"]
        operator = EqualsOperator(kind=OperatorKind.EQUALS, value=values)

        with pytest.raises(ConditionTypeMismatchException):
            operator.match(condition_property="foo", segment_name="test")

        not_operator = NotEqualsOperator(kind=OperatorKind.NOT_EQUALS, value=values)
        with pytest.raises(ConditionTypeMismatchException):
            not_operator.match(condition_property="foo", segment_name="test")

    def test_valid_json_parsing_with_types(self):
        values = [1, 2.2, "abc", True, False, [], ["foo"], [1], [1.1]]
        assert_valid_types(operator=EqualsOperator, expected_types=values)
        assert_valid_types(operator=NotEqualsOperator, expected_types=values)

    def test_invalid_value_type_parsing(self):
        values = [None, dict(foo="bar")]
        assert_invalid_types(operator=EqualsOperator, invalid_types=values)
        assert_invalid_types(operator=NotEqualsOperator, invalid_types=values)
