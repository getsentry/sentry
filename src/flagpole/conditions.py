from abc import abstractmethod
from enum import Enum
from typing import Annotated, Any, Literal, TypeVar

from pydantic import BaseModel, Field, StrictBool, StrictFloat, StrictInt, StrictStr, constr

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
    """Comprare a value to another. Values are compared with types"""

    NOT_EQUALS = "not_equals"
    """Comprare a value to not be equal to another. Values are compared with types"""


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


class ConditionBase(BaseModel):
    property: str
    operator: ConditionOperatorKind
    value: Any

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


InOperatorValueTypes = list[StrictInt] | list[StrictFloat] | list[StrictStr]


class InCondition(ConditionBase):
    operator: Literal[ConditionOperatorKind.IN] = ConditionOperatorKind.IN
    value: InOperatorValueTypes

    def _operator_match(self, condition_property: Any, segment_name: str):
        return self._evaluate_in(condition_property=condition_property, segment_name=segment_name)


class NotInCondition(ConditionBase):
    operator: Literal[ConditionOperatorKind.NOT_IN] = ConditionOperatorKind.NOT_IN
    value: InOperatorValueTypes

    def _operator_match(self, condition_property: Any, segment_name: str):
        return not self._evaluate_in(
            condition_property=condition_property, segment_name=segment_name
        )


ContainsOperatorValueTypes = StrictInt | StrictStr | StrictFloat


class ContainsCondition(ConditionBase):
    operator: Literal[ConditionOperatorKind.CONTAINS] = ConditionOperatorKind.CONTAINS
    value: StrictInt | StrictStr | StrictFloat

    def _operator_match(self, condition_property: Any, segment_name: str):
        return self._evaluate_contains(
            condition_property=condition_property, segment_name=segment_name
        )


class NotContainsCondition(ConditionBase):
    operator: Literal[ConditionOperatorKind.NOT_CONTAINS] = ConditionOperatorKind.NOT_CONTAINS
    value: ContainsOperatorValueTypes

    def _operator_match(self, condition_property: Any, segment_name: str):
        return not self._evaluate_contains(
            condition_property=condition_property, segment_name=segment_name
        )


EqualsOperatorValueTypes = (
    StrictInt
    | StrictFloat
    | StrictStr
    | StrictBool
    | list[StrictInt]
    | list[StrictFloat]
    | list[StrictStr]
)


class EqualsCondition(ConditionBase):
    operator: Literal[ConditionOperatorKind.EQUALS] = ConditionOperatorKind.EQUALS
    value: EqualsOperatorValueTypes

    def _operator_match(self, condition_property: Any, segment_name: str):
        return self._evaluate_equals(
            condition_property=condition_property, segment_name=segment_name
        )


class NotEqualsCondition(ConditionBase):
    operator: Literal[ConditionOperatorKind.NOT_EQUALS] = ConditionOperatorKind.NOT_EQUALS
    value: EqualsOperatorValueTypes

    def _operator_match(self, condition_property: Any, segment_name: str):
        return not self._evaluate_equals(
            condition_property=condition_property, segment_name=segment_name
        )


# We have to group and annotate all the different subclasses of Operator
# in order for Pydantic to be able to discern between the different types
# when parsing a dict or JSON.
AvailableConditions = Annotated[
    InCondition
    | NotInCondition
    | ContainsCondition
    | NotContainsCondition
    | EqualsCondition
    | NotEqualsCondition,
    Field(discriminator="operator"),
]


class Segment(BaseModel):
    name: constr(min_length=1)  # type:ignore[valid-type]
    conditions: list[AvailableConditions]
    rollout: int | None = 0

    def match(self, context: EvaluationContext) -> bool:
        for condition in self.conditions:
            match_condition = condition.match(context, segment_name=self.name)
            if not match_condition:
                return False
        # Apply incremental rollout if available.
        if self.rollout is not None and self.rollout < 100:
            return context.id() % 100 <= self.rollout

        return True
