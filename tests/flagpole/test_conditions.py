import pytest

from flagpole import EvaluationContext
from flagpole.conditions import (
    ConditionTypeMismatchException,
    ContainsCondition,
    EqualsCondition,
    InCondition,
    MatchesCondition,
    NotContainsCondition,
    NotEqualsCondition,
    NotInCondition,
    create_case_insensitive_set_from_list,
)


class TestCreateCaseInsensitiveSetFromList:
    def test_empty_set(self) -> None:
        assert create_case_insensitive_set_from_list([]) == set()

    def test_returns_int_set(self) -> None:
        assert create_case_insensitive_set_from_list([1, 2, 3]) == {1, 2, 3}

    def test_returns_float_set(self) -> None:
        assert create_case_insensitive_set_from_list([1.1, 2.2, 3.3]) == {1.1, 2.2, 3.3}

    def test_returns_lowercase_string_set(self) -> None:
        assert create_case_insensitive_set_from_list(["AbC", "DEF"]) == {"abc", "def"}


class TestInConditions:
    def test_is_in(self) -> None:
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

    def test_is_in_numeric_string(self) -> None:
        values = ["123", "456"]
        condition = InCondition(property="foo", value=values, operator="in")
        assert condition.value == values
        assert not condition.match(context=EvaluationContext({"foo": 123}), segment_name="test")
        assert condition.match(context=EvaluationContext({"foo": "123"}), segment_name="test")

    def test_is_not_in(self) -> None:
        values = ["bar", "baz"]
        condition = InCondition(property="foo", value=values)
        assert not condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_condition = NotInCondition(property="foo", value=values)
        assert not_condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

    def test_is_in_case_insensitivity(self) -> None:
        values = ["bAr", "baz"]
        condition = InCondition(property="foo", value=values)
        assert condition.match(context=EvaluationContext({"foo": "BaR"}), segment_name="test")

        not_condition = NotInCondition(property="foo", value=values)
        assert not not_condition.match(
            context=EvaluationContext({"foo": "BaR"}), segment_name="test"
        )

    def test_invalid_property_value(self) -> None:
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

    def test_missing_context_property(self) -> None:
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
    def test_does_contain(self) -> None:
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

    def test_does_not_contain(self) -> None:
        values = "baz"
        condition = ContainsCondition(property="foo", value=values, operator="contains")
        assert not condition.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

        not_condition = NotContainsCondition(property="foo", value=values)
        assert not_condition.match(
            context=EvaluationContext({"foo": ["foo", "bar"]}), segment_name="test"
        )

    def test_invalid_property_provided(self) -> None:
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

    def test_missing_context_property(self) -> None:
        condition = ContainsCondition(property="foo", value="bar")

        with pytest.raises(ConditionTypeMismatchException):
            condition.match(context=EvaluationContext({"bar": ["foo", "bar"]}), segment_name="test")

        not_condition = NotContainsCondition(property="foo", value="bar")

        with pytest.raises(ConditionTypeMismatchException):
            not_condition.match(
                context=EvaluationContext({"bar": ["foo", "bar"]}), segment_name="test"
            )


class TestEqualsConditions:
    def test_is_equal_string(self) -> None:
        value = "foo"
        condition = EqualsCondition(property="foo", value=value)
        assert condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_condition = NotEqualsCondition(property="foo", value=value)
        assert not not_condition.match(
            context=EvaluationContext({"foo": "foo"}), segment_name="test"
        )

    def test_is_not_equals(self) -> None:
        values = "bar"
        condition = EqualsCondition(property="foo", value=values)
        assert not condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_condition = NotEqualsCondition(property="foo", value=values)
        assert not_condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

    def test_is_equal_case_insensitive(self) -> None:
        values = "bAr"
        condition = EqualsCondition(property="foo", value=values)
        assert condition.match(context=EvaluationContext({"foo": "BaR"}), segment_name="test")

        not_condition = NotEqualsCondition(property="foo", value=values)
        assert not not_condition.match(
            context=EvaluationContext({"foo": "BaR"}), segment_name="test"
        )

    def test_equality_type_mismatch_strings(self) -> None:
        values = ["foo", "bar"]
        condition = EqualsCondition(property="foo", value=values, operator="equals")

        with pytest.raises(ConditionTypeMismatchException):
            condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")

        not_condition = NotEqualsCondition(property="foo", value=values)
        with pytest.raises(ConditionTypeMismatchException):
            not_condition.match(context=EvaluationContext({"foo": "foo"}), segment_name="test")


class TestMatchesConditions:
    def test_literal_match(self) -> None:
        condition = MatchesCondition(property="slug", value=["sentry"])
        assert condition.match(context=EvaluationContext({"slug": "sentry"}), segment_name="test")
        assert not condition.match(
            context=EvaluationContext({"slug": "getsentry"}), segment_name="test"
        )

    def test_prefix_wildcard(self) -> None:
        condition = MatchesCondition(property="slug", value=["jayonb*"])
        assert condition.match(context=EvaluationContext({"slug": "jayonb73"}), segment_name="test")
        assert condition.match(context=EvaluationContext({"slug": "jayonb"}), segment_name="test")
        assert not condition.match(
            context=EvaluationContext({"slug": "dangoldonb1"}), segment_name="test"
        )

    def test_prefix_and_suffix_wildcard(self) -> None:
        condition = MatchesCondition(property="email", value=["jay.goss+onboarding*@sentry.io"])
        assert condition.match(
            context=EvaluationContext({"email": "jay.goss+onboarding70@sentry.io"}),
            segment_name="test",
        )
        assert condition.match(
            context=EvaluationContext({"email": "jay.goss+onboarding@sentry.io"}),
            segment_name="test",
        )
        assert not condition.match(
            context=EvaluationContext({"email": "jay.goss+onboarding70@example.com"}),
            segment_name="test",
        )

    def test_suffix_wildcard(self) -> None:
        condition = MatchesCondition(property="email", value=["*@sentry.io"])
        assert condition.match(
            context=EvaluationContext({"email": "user@sentry.io"}), segment_name="test"
        )
        assert not condition.match(
            context=EvaluationContext({"email": "user@example.com"}), segment_name="test"
        )

    def test_multi_segment_wildcard(self) -> None:
        condition = MatchesCondition(property="name", value=["a*b*c"])
        assert condition.match(context=EvaluationContext({"name": "abc"}), segment_name="test")
        assert condition.match(context=EvaluationContext({"name": "aXbYc"}), segment_name="test")
        assert condition.match(context=EvaluationContext({"name": "aXXbYYc"}), segment_name="test")
        assert not condition.match(context=EvaluationContext({"name": "aXXc"}), segment_name="test")

    def test_star_only_pattern(self) -> None:
        condition = MatchesCondition(property="slug", value=["*"])
        assert condition.match(context=EvaluationContext({"slug": "anything"}), segment_name="test")
        assert condition.match(context=EvaluationContext({"slug": ""}), segment_name="test")

    def test_case_insensitive(self) -> None:
        condition = MatchesCondition(property="slug", value=["JAYONB*"])
        assert condition.match(context=EvaluationContext({"slug": "jayonb73"}), segment_name="test")
        condition2 = MatchesCondition(property="slug", value=["jayonb*"])
        assert condition2.match(
            context=EvaluationContext({"slug": "JAYONB73"}), segment_name="test"
        )

    def test_no_match(self) -> None:
        condition = MatchesCondition(property="slug", value=["jayonb*"])
        assert not condition.match(
            context=EvaluationContext({"slug": "dangoldonb1"}), segment_name="test"
        )

    def test_multiple_patterns_first_match_wins(self) -> None:
        condition = MatchesCondition(
            property="slug", value=["jayonb*", "dangoldonb*", "value-disc-*"]
        )
        assert condition.match(context=EvaluationContext({"slug": "jayonb73"}), segment_name="test")
        assert condition.match(
            context=EvaluationContext({"slug": "dangoldonb3"}), segment_name="test"
        )
        assert condition.match(
            context=EvaluationContext({"slug": "value-disc-7"}), segment_name="test"
        )
        assert not condition.match(
            context=EvaluationContext({"slug": "other-org"}), segment_name="test"
        )

    def test_overlapping_prefix_suffix_anchors(self) -> None:
        # "a*a" requires at least "aa" — a single "a" must not match.
        condition = MatchesCondition(property="slug", value=["a*a"])
        assert not condition.match(context=EvaluationContext({"slug": "a"}), segment_name="test")
        assert condition.match(context=EvaluationContext({"slug": "aa"}), segment_name="test")
        # "ab*ab" requires at least "abab" — "ab" alone must not match.
        condition2 = MatchesCondition(property="slug", value=["ab*ab"])
        assert not condition2.match(context=EvaluationContext({"slug": "ab"}), segment_name="test")
        assert condition2.match(context=EvaluationContext({"slug": "abab"}), segment_name="test")

    def test_type_mismatch_list_property(self) -> None:
        condition = MatchesCondition(property="foo", value=["bar*"])
        with pytest.raises(ConditionTypeMismatchException):
            condition.match(
                context=EvaluationContext({"foo": ["bar1", "bar2"]}), segment_name="test"
            )

    def test_type_mismatch_dict_property(self) -> None:
        condition = MatchesCondition(property="foo", value=["bar*"])
        with pytest.raises(ConditionTypeMismatchException):
            condition.match(context=EvaluationContext({"foo": {"key": "val"}}), segment_name="test")
