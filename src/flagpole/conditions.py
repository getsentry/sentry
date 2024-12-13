import dataclasses
from abc import abstractmethod
from collections.abc import Mapping
from enum import Enum
from typing import Any, Self, TypeVar

from flagpole.evaluation_context import EvaluationContext


class ConditionOperatorKind(str, Enum):
    IN = "in"
    """Provided a list of values, check if the property value is in the list ov values"""

    NOT_IN = "not_in"

    CONTAINS = "contains"
    """Provided a single value, check if the property (a list) is included"""

    NOT_CONTAINS = "not_contains"
    """Provided a single value, check if the property (a list) is not included"""

    EQUALS = "equals"
    """Compare a value to another. Values are compared with types"""

    NOT_EQUALS = "not_equals"
    """Compare a value to not be equal to another. Values are compared with types"""


class ConditionTypeMismatchException(Exception):
    pass


def get_type_name(value: Any):
    return type(value).__name__


T = TypeVar("T", str, int, float)


def create_case_insensitive_set_from_list(values: list[T]) -> set[T]:
    case_insensitive_set = set()
    for value in values:
        if isinstance(value, str):
            case_insensitive_set.add(value.lower())
        else:
            case_insensitive_set.add(value)

    return case_insensitive_set


@dataclasses.dataclass(frozen=True)
class ConditionBase:
    property: str
    """The evaluation context property to match against."""

    value: Any
    """The value to compare against the condition's evaluation context property."""

    operator: str = dataclasses.field(default="")
    """
    The name of the operator to use when comparing the evaluation context property to the condition's value.
    Values must be a valid ConditionOperatorKind.
    """

    def match(self, context: EvaluationContext, segment_name: str) -> bool:
        return self._operator_match(
            condition_property=context.get(self.property), segment_name=segment_name
        )

    @abstractmethod
    def _operator_match(self, condition_property: Any, segment_name: str) -> bool:
        raise NotImplementedError("Each Condition needs to implement this method")

    def _evaluate_in(self, condition_property: Any, segment_name: str) -> bool:
        if not isinstance(self.value, list):
            raise ConditionTypeMismatchException(
                f"'In' condition value must be a list, but was provided a '{get_type_name(self.value)}'"
                + f" of segment {segment_name}"
            )
        if isinstance(condition_property, (list, dict)):
            raise ConditionTypeMismatchException(
                "'In' condition property value must be str | int | float | bool | None, but was provided a"
                + f"'{get_type_name(self.value)}' of segment {segment_name}"
            )
        if isinstance(condition_property, str):
            condition_property = condition_property.lower()

        return condition_property in create_case_insensitive_set_from_list(self.value)

    def _evaluate_contains(self, condition_property: Any, segment_name: str) -> bool:
        if not isinstance(condition_property, list):
            raise ConditionTypeMismatchException(
                f"'Contains' can only be checked against a list, but was given a {get_type_name(condition_property)}"
                + f" context property '{condition_property}' of segment '{segment_name}'"
            )
        value = self.value
        if isinstance(value, str):
            value = value.lower()

        return value in create_case_insensitive_set_from_list(condition_property)

    def _evaluate_equals(self, condition_property: Any, segment_name: str) -> bool:
        if condition_property is None:
            return False

        if not isinstance(condition_property, type(self.value)):
            value_type = get_type_name(self.value)
            property_value = get_type_name(condition_property)
            raise ConditionTypeMismatchException(
                "'Equals' operator cannot be applied to values of mismatching types"
                + f"({value_type} and {property_value}) for segment {segment_name}"
            )

        if isinstance(condition_property, str):
            return condition_property.lower() == self.value.lower()

        return condition_property == self.value


InOperatorValueTypes = list[int] | list[float] | list[str]


class InCondition(ConditionBase):
    value: InOperatorValueTypes
    operator: str = dataclasses.field(default="in")

    def _operator_match(self, condition_property: Any, segment_name: str):
        return self._evaluate_in(condition_property=condition_property, segment_name=segment_name)


class NotInCondition(ConditionBase):
    value: InOperatorValueTypes
    operator: str = dataclasses.field(default="not_in")

    def _operator_match(self, condition_property: Any, segment_name: str):
        return not self._evaluate_in(
            condition_property=condition_property, segment_name=segment_name
        )


ContainsOperatorValueTypes = int | str | float


class ContainsCondition(ConditionBase):
    value: ContainsOperatorValueTypes
    operator: str = dataclasses.field(default="contains")

    def _operator_match(self, condition_property: Any, segment_name: str):
        return self._evaluate_contains(
            condition_property=condition_property, segment_name=segment_name
        )


class NotContainsCondition(ConditionBase):
    value: ContainsOperatorValueTypes
    operator: str = dataclasses.field(default="not_contains")

    def _operator_match(self, condition_property: Any, segment_name: str):
        return not self._evaluate_contains(
            condition_property=condition_property, segment_name=segment_name
        )


EqualsOperatorValueTypes = int | float | str | bool | list[int] | list[float] | list[str]


class EqualsCondition(ConditionBase):
    value: EqualsOperatorValueTypes
    operator: str = dataclasses.field(default="equals")

    def _operator_match(self, condition_property: Any, segment_name: str):
        return self._evaluate_equals(
            condition_property=condition_property,
            segment_name=segment_name,
        )


class NotEqualsCondition(ConditionBase):
    value: EqualsOperatorValueTypes
    operator: str = dataclasses.field(default="not_equals")

    def _operator_match(self, condition_property: Any, segment_name: str):
        return not self._evaluate_equals(
            condition_property=condition_property,
            segment_name=segment_name,
        )


OPERATOR_LOOKUP: Mapping[ConditionOperatorKind, type[ConditionBase]] = {
    ConditionOperatorKind.IN: InCondition,
    ConditionOperatorKind.NOT_IN: NotInCondition,
    ConditionOperatorKind.CONTAINS: ContainsCondition,
    ConditionOperatorKind.NOT_CONTAINS: NotContainsCondition,
    ConditionOperatorKind.EQUALS: EqualsCondition,
    ConditionOperatorKind.NOT_EQUALS: NotEqualsCondition,
}


def condition_from_dict(data: Mapping[str, Any]) -> ConditionBase:
    operator_kind = ConditionOperatorKind(data.get("operator", "invalid"))
    if operator_kind not in OPERATOR_LOOKUP:
        valid = ", ".join(OPERATOR_LOOKUP.keys())
        raise ValueError(f"The {operator_kind} is not a known operator. Choose from {valid}")

    condition_cls = OPERATOR_LOOKUP[operator_kind]
    return condition_cls(
        property=str(data.get("property")), operator=operator_kind.value, value=data.get("value")
    )


@dataclasses.dataclass
class Segment:
    name: str
    "A brief description or identifier for the segment"

    conditions: list[ConditionBase] = dataclasses.field(default_factory=list)
    "The list of conditions that the segment must be matched in order for this segment to be active"

    rollout: int | None = dataclasses.field(default=100)
    """
    Rollout rate controls how many buckets will be granted a feature when this segment matches.

    Rollout rates range from 0 (off) to 100 (all users). Rollout rates use `context.id`
    to determine bucket membership consistently over time.
    """

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> Self:
        conditions = [condition_from_dict(condition) for condition in data.get("conditions", [])]
        return cls(
            name=str(data.get("name", "")),
            rollout=int(data.get("rollout", 100)),
            conditions=conditions,
        )

    def match(self, context: EvaluationContext) -> bool:
        for condition in self.conditions:
            match_condition = condition.match(context, segment_name=self.name)
            if not match_condition:
                return False
        return True

    def in_rollout(self, context: EvaluationContext) -> bool:
        # Rollout = 0 allows segments to match and disable a feature
        # even if other segments would match
        if self.rollout == 0:
            return False

        # Apply incremental rollout if available.
        if self.rollout is not None and self.rollout < 100:
            return context.id % 100 <= self.rollout

        return True
