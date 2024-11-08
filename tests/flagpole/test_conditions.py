import pytest

from flagpole import EvaluationContext
from flagpole.conditions import (
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


class TestInConditions:
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
        condition = InCondition(property="foo", value=values, operator="in")
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

        bad_context = ([1], {"k": "v"})
        for attr_val in bad_context:
            with pytest.raises(ConditionTypeMismatchException):
                condition.match(context=EvaluationContext({"foo": attr_val}), segment_name="test")

        not_condition = NotInCondition(property="foo", value=values)
        for attr_val in bad_context:
            with pytest.raises(ConditionTypeMismatchException):
                not_condition.match(
                    context=EvaluationContext({"foo": attr_val}), segment_name="test"
                )

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
        condition = ContainsCondition(property="foo", value=values, operator="contains")
        assert not condition.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

        not_condition = NotContainsCondition(property="foo", value=values)
        assert not_condition.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

    def test_invalid_property_provided(self):
        values = "baz"
        bad_context = ("oops", "1", 1, 3.14, None, False, True)

        for attr_val in bad_context:
            with pytest.raises(ConditionTypeMismatchException):
                condition = ContainsCondition(property="foo", value=values)
                assert not condition.match(
                    context=EvaluationContext({"foo": attr_val}), segment_name="test"
                )

        for attr_val in bad_context:
            with pytest.raises(ConditionTypeMismatchException):
                not_condition = NotContainsCondition(property="foo", value=values)
                assert not_condition.match(
                    context=EvaluationContext({"foo": attr_val}), segment_name="test"
                )

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
        condition = EqualsCondition(property="foo", value=values, operator="equals")

        with pytest.raises(ConditionTypeMismatchException):
            condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_condition = NotEqualsCondition(property="foo", value=values)
        with pytest.raises(ConditionTypeMismatchException):
            not_condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")
