"""
Condition Types for Rule Evaluation

These type definitions are mirrored from the Relay project's RuleCondition enum.
For the original definitions, see:
https://getsentry.github.io/relay/relay_protocol/condition/enum.RuleCondition.html

This file provides Python type hints that correspond to the Rust types used in Relay.
"""

from typing import Literal, NotRequired, TypedDict, Union

# A value that can be matched against
Value = str | float | int | list[str] | list[float] | list[int]


class EqConditionOptions(TypedDict):
    """Options specific to the equality condition"""

    ignoreCase: bool


class EqCondition(TypedDict):
    """Equality condition"""

    op: Literal["eq"]
    name: str
    value: Value | None
    options: NotRequired[EqConditionOptions]


class GteCondition(TypedDict):
    """Greater than or equal condition"""

    op: Literal["gte"]
    name: str
    value: Value | None


class GtCondition(TypedDict):
    """Greater than condition"""

    op: Literal["gt"]
    name: str
    value: Value | None


class LteCondition(TypedDict):
    """Less than or equal condition"""

    op: Literal["lte"]
    name: str
    value: Value | None


class LtCondition(TypedDict):
    """Less than condition"""

    op: Literal["lt"]
    name: str
    value: Value | None


class GlobCondition(TypedDict):
    """Glob pattern matching condition

    Glob matching is done in Relay with the following crate: https://docs.rs/globset/latest/globset
    """

    op: Literal["glob"]
    name: str
    value: list[str]


class IterableCondition(TypedDict):
    """Condition for iterating over a list and applying a nested condition"""

    op: Literal["any", "all"]
    inner: "RuleCondition"


class BooleanCondition(TypedDict):
    """Compound condition for combining multiple conditions with boolean operators"""

    op: Literal["and", "or"]
    inner: list["RuleCondition"]


class NotCondition(TypedDict):
    """Compound condition that negates the inner rule"""

    op: Literal["not"]
    inner: "RuleCondition"


# Union type representing any possible condition
RuleCondition = Union[
    BooleanCondition,
    NotCondition,
    IterableCondition,
    EqCondition,
    GteCondition,
    GtCondition,
    LteCondition,
    LtCondition,
    GlobCondition,
]
