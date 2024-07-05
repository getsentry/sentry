"""
Condition Types for Rule Evaluation

These type definitions are mirrored from the Relay project's RuleCondition enum.
For the original definitions, see:
https://getsentry.github.io/relay/relay_protocol/condition/enum.RuleCondition.html

This file provides Python type hints that correspond to the Rust types used in Relay.
"""

from typing import Literal, TypedDict, Union


# Options specific to the equality condition
class EqConditionOptions(TypedDict):
    ignoreCase: bool


# Equality condition: checks if a field equals a specific value
class EqCondition(TypedDict):
    op: Literal["eq"]
    name: str
    value: list[str] | None
    options: EqConditionOptions


# Greater than or equal condition
class GteCondition(TypedDict):
    op: Literal["gte"]
    name: str
    value: list[str] | None


# Greater than condition
class GtCondition(TypedDict):
    op: Literal["gt"]
    name: str
    value: list[str] | None


# Less than or equal condition
class LteCondition(TypedDict):
    op: Literal["lte"]
    name: str
    value: list[str] | None


# Less than condition
class LtCondition(TypedDict):
    op: Literal["lt"]
    name: str
    value: list[str] | None


# Glob pattern matching condition
class GlobCondition(TypedDict):
    op: Literal["glob"]
    name: str
    value: list[str]


# Condition for iterating over a list and applying a nested condition
class ForLoopCondition(TypedDict):
    op: Literal["any", "all"]
    inner: "RuleCondition"


# Compound condition for combining multiple conditions with boolean operators
class BooleanCondition(TypedDict):
    op: Literal["and", "or", "not"]
    inner: Union["RuleCondition", list["RuleCondition"]]


# Union type representing any possible condition
RuleCondition = Union[
    BooleanCondition,
    ForLoopCondition,
    EqCondition,
    GteCondition,
    GtCondition,
    LteCondition,
    LtCondition,
    GlobCondition,
]
