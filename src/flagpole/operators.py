from abc import ABC, abstractmethod
from enum import Enum
from typing import Annotated, Any, Literal, TypeVar

from pydantic import BaseModel, Field, StrictBool, StrictFloat, StrictInt, StrictStr


def get_type_name(value: Any):
    return type(value).__name__


class ConditionTypeMismatchException(Exception):
    pass


class OperatorKind(str, Enum):
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


class Operator(BaseModel, ABC):
    kind: OperatorKind
    value: Any

    @abstractmethod
    def match(self, condition_property: Any, segment_name: str):
        raise NotImplementedError("Each Operator needs to implement this method")


def evaluate_in(condition_property: Any, operator: Operator, segment_name: str) -> bool:
    if not isinstance(operator.value, list):
        raise ConditionTypeMismatchException(
            f"'In' condition value must be a list, but was provided a '{get_type_name(operator.value)}'"
            + f" of segment {segment_name}"
        )
    if isinstance(condition_property, (list, dict)):
        raise ConditionTypeMismatchException(
            f"'In' condition property value must be str | int | float | bool | None, but was provided a '{get_type_name(operator.value)}'"
            + f" of segment {segment_name}"
        )
    if isinstance(condition_property, str):
        condition_property = condition_property.lower()

    return condition_property in create_case_insensitive_set_from_list(operator.value)


def evaluate_contains(condition_property: Any, operator: Operator, segment_name: str) -> bool:
    if not isinstance(condition_property, list):
        raise ConditionTypeMismatchException(
            f"'Contains' can only be checked against a list, but was given a {get_type_name(condition_property)}"
            + f" context property '{condition_property}' of segment '{segment_name}'"
        )
    value = operator.value
    if isinstance(value, str):
        value = value.lower()

    return value in create_case_insensitive_set_from_list(condition_property)


def evaluate_equals(condition_property: Any, operator: Operator, segment_name: str) -> bool:
    if not isinstance(condition_property, type(operator.value)):
        value_type = get_type_name(operator.value)
        property_value = get_type_name(condition_property)
        raise ConditionTypeMismatchException(
            "'Equals' operator cannot be applied to values of mismatching types"
            + f"({value_type} and {property_value}) for segment {segment_name}"
        )

    if isinstance(condition_property, str):
        return condition_property.lower() == operator.value.lower()

    return condition_property == operator.value


T = TypeVar("T", str, int, float)


def create_case_insensitive_set_from_list(values: list[T]) -> set[T]:
    case_insensitive_set = set()
    for value in values:
        if isinstance(value, str):
            case_insensitive_set.add(value.lower())
        else:
            case_insensitive_set.add(value)

    return case_insensitive_set


InOperatorValueTypes = list[StrictInt] | list[StrictFloat] | list[StrictStr]


class InOperator(Operator):
    kind: Literal[OperatorKind.IN] = OperatorKind.IN
    value: InOperatorValueTypes

    def match(self, condition_property: Any, segment_name: str):
        return evaluate_in(
            condition_property=condition_property, segment_name=segment_name, operator=self
        )


class NotInOperator(Operator):
    kind: Literal[OperatorKind.NOT_IN] = OperatorKind.NOT_IN
    value: InOperatorValueTypes

    def match(self, condition_property: Any, segment_name: str):
        return not evaluate_in(
            condition_property=condition_property, segment_name=segment_name, operator=self
        )


ContainsOperatorValueTypes = StrictInt | StrictStr | StrictFloat


class ContainsOperator(Operator):
    kind: Literal[OperatorKind.CONTAINS] = OperatorKind.CONTAINS
    value: StrictInt | StrictStr | StrictFloat

    def match(self, condition_property: Any, segment_name: str):
        return evaluate_contains(
            condition_property=condition_property, segment_name=segment_name, operator=self
        )


class NotContainsOperator(Operator):
    kind: Literal[OperatorKind.NOT_CONTAINS] = OperatorKind.NOT_CONTAINS
    value: ContainsOperatorValueTypes

    def match(self, condition_property: Any, segment_name: str):
        return not evaluate_contains(
            condition_property=condition_property, segment_name=segment_name, operator=self
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


class EqualsOperator(Operator):
    kind: Literal[OperatorKind.EQUALS] = OperatorKind.EQUALS
    value: EqualsOperatorValueTypes

    def match(self, condition_property: Any, segment_name: str):
        return evaluate_equals(
            condition_property=condition_property, segment_name=segment_name, operator=self
        )


class NotEqualsOperator(Operator):
    kind: Literal[OperatorKind.NOT_EQUALS] = OperatorKind.NOT_EQUALS
    value: EqualsOperatorValueTypes

    def match(self, condition_property: Any, segment_name: str):
        return not evaluate_equals(
            condition_property=condition_property, segment_name=segment_name, operator=self
        )


# We have to group and annotate all the different subclasses of Operator
# in order for Pydantic to be able to discern between the different types
# when parsing a dict or JSON.
AvailableOperators = Annotated[
    InOperator
    | NotInOperator
    | ContainsOperator
    | NotContainsOperator
    | EqualsOperator
    | NotEqualsOperator,
    Field(discriminator="kind"),
]
