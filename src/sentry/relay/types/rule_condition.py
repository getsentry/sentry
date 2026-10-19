"""
Rule Conditions

The conditions Relay evaluates against an item, mirrored from Relay's ``RuleCondition``
enum. For the original definitions, see:
https://getsentry.github.io/relay/relay_protocol/condition/enum.RuleCondition.html

Build a condition from the dataclasses and ``serialize`` it where it enters a config.
``SerializedRuleCondition`` is the form Relay reads.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal, NotRequired, TypedDict, Union

# A value that can be matched against
Value = str | float | int | list[str] | list[float] | list[int]

ReleaseComparator = Literal["eq", "gt", "gte", "lt", "lte"]


class SerializedEqConditionOptions(TypedDict):
    ignoreCase: bool


class SerializedEqCondition(TypedDict):
    op: Literal["eq"]
    name: str
    value: Value | None
    options: NotRequired[SerializedEqConditionOptions]


class SerializedGteCondition(TypedDict):
    op: Literal["gte"]
    name: str
    value: Value | None


class SerializedGtCondition(TypedDict):
    op: Literal["gt"]
    name: str
    value: Value | None


class SerializedLteCondition(TypedDict):
    op: Literal["lte"]
    name: str
    value: Value | None


class SerializedLtCondition(TypedDict):
    op: Literal["lt"]
    name: str
    value: Value | None


class SerializedGlobCondition(TypedDict):
    op: Literal["glob"]
    name: str
    value: list[str]


class SerializedCidrCondition(TypedDict):
    op: Literal["cidr"]
    name: str
    value: list[str]


class SerializedReleaseCondition(TypedDict):
    op: Literal["release"]
    name: str
    comparator: ReleaseComparator
    value: str


class SerializedIterableCondition(TypedDict):
    op: Literal["any", "all"]
    name: str
    inner: "SerializedRuleCondition"


class SerializedBooleanCondition(TypedDict):
    op: Literal["and", "or"]
    inner: list["SerializedRuleCondition"]


class SerializedNotCondition(TypedDict):
    op: Literal["not"]
    inner: "SerializedRuleCondition"


SerializedRuleCondition = Union[
    SerializedBooleanCondition,
    SerializedNotCondition,
    SerializedIterableCondition,
    SerializedEqCondition,
    SerializedGteCondition,
    SerializedGtCondition,
    SerializedLteCondition,
    SerializedLtCondition,
    SerializedGlobCondition,
    SerializedCidrCondition,
    SerializedReleaseCondition,
]


class RuleCondition(ABC):
    """
    A condition on an item, such as an event or a log.

    Every condition reads a field of the item by ``name``, a dotted path such as
    ``event.release``, or combines other conditions. A field the item does not carry
    never matches.
    """

    @abstractmethod
    def serialize(self) -> SerializedRuleCondition:
        """The condition in the form Relay reads."""


@dataclass(frozen=True)
class EqCondition(RuleCondition):
    """
    The field equals ``value``, or one of the values if it is a list.

    Relay compares booleans, strings, and UUIDs.
    """

    name: str
    value: Value | None
    ignore_case: bool = False

    def serialize(self) -> SerializedEqCondition:
        serialized: SerializedEqCondition = {"op": "eq", "name": self.name, "value": self.value}
        if self.ignore_case:
            serialized["options"] = {"ignoreCase": True}
        return serialized


@dataclass(frozen=True)
class GteCondition(RuleCondition):
    """The field is greater than or equal to ``value``."""

    name: str
    value: Value | None

    def serialize(self) -> SerializedGteCondition:
        return {"op": "gte", "name": self.name, "value": self.value}


@dataclass(frozen=True)
class GtCondition(RuleCondition):
    """The field is greater than ``value``."""

    name: str
    value: Value | None

    def serialize(self) -> SerializedGtCondition:
        return {"op": "gt", "name": self.name, "value": self.value}


@dataclass(frozen=True)
class LteCondition(RuleCondition):
    """The field is less than or equal to ``value``."""

    name: str
    value: Value | None

    def serialize(self) -> SerializedLteCondition:
        return {"op": "lte", "name": self.name, "value": self.value}


@dataclass(frozen=True)
class LtCondition(RuleCondition):
    """The field is less than ``value``."""

    name: str
    value: Value | None

    def serialize(self) -> SerializedLtCondition:
        return {"op": "lt", "name": self.name, "value": self.value}


@dataclass(frozen=True)
class GlobCondition(RuleCondition):
    """
    The field matches one of the glob ``patterns``.

    Relay matches with the ``globset`` crate: https://docs.rs/globset/latest/globset
    """

    name: str
    patterns: list[str]

    def serialize(self) -> SerializedGlobCondition:
        return {"op": "glob", "name": self.name, "value": list(self.patterns)}


@dataclass(frozen=True)
class CidrCondition(RuleCondition):
    """
    The field holds an IP address inside one of the ``networks``, each a single
    address or a CIDR range. Relay ignores a network that is neither.
    """

    name: str
    networks: list[str]

    def serialize(self) -> SerializedCidrCondition:
        return {"op": "cidr", "name": self.name, "value": list(self.networks)}


@dataclass(frozen=True)
class ReleaseCondition(RuleCondition):
    """
    The version of the release in the field compares to ``release`` as ``comparator``
    says.

    ``release`` is a release such as ``1.2.0`` or ``myapp@1.2.0``. With a package it
    only matches releases of that package. A field or release without a version, such
    as a commit hash, never matches. A Relay without the operation reads the condition
    as unsupported and never matches it.
    """

    name: str
    comparator: ReleaseComparator
    release: str

    def serialize(self) -> SerializedReleaseCondition:
        return {
            "op": "release",
            "name": self.name,
            "comparator": self.comparator,
            "value": self.release,
        }


@dataclass(frozen=True)
class AnyCondition(RuleCondition):
    """``inner`` matches at least one element of the list in the field."""

    name: str
    inner: RuleCondition

    def serialize(self) -> SerializedIterableCondition:
        return {"op": "any", "name": self.name, "inner": self.inner.serialize()}


@dataclass(frozen=True)
class AllCondition(RuleCondition):
    """``inner`` matches every element of the list in the field."""

    name: str
    inner: RuleCondition

    def serialize(self) -> SerializedIterableCondition:
        return {"op": "all", "name": self.name, "inner": self.inner.serialize()}


@dataclass(frozen=True)
class AndCondition(RuleCondition):
    """Every one of ``inner`` matches."""

    inner: list[RuleCondition]

    def serialize(self) -> SerializedBooleanCondition:
        return {"op": "and", "inner": [condition.serialize() for condition in self.inner]}


@dataclass(frozen=True)
class OrCondition(RuleCondition):
    """At least one of ``inner`` matches."""

    inner: list[RuleCondition]

    def serialize(self) -> SerializedBooleanCondition:
        return {"op": "or", "inner": [condition.serialize() for condition in self.inner]}


@dataclass(frozen=True)
class NotCondition(RuleCondition):
    """``inner`` does not match."""

    inner: RuleCondition

    def serialize(self) -> SerializedNotCondition:
        return {"op": "not", "inner": self.inner.serialize()}
