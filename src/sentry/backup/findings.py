from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from enum import IntEnum, auto, unique
from typing import Any, Dict, List, NamedTuple, Optional

from sentry.utils import json


class InstanceID(NamedTuple):
    """Every entry in the generated backup JSON file should have a unique model+ordinal combination,
    which serves as its identifier."""

    model: str

    # The order that this model appeared in the JSON inputs. Because we validate that the same
    # number of models of each kind are present on both the left and right side when validating, we
    # can use the ordinal as a unique identifier.
    ordinal: Optional[int] = None

    def pretty(self) -> str:
        out = f"InstanceID(model: {self.model!r}"
        if self.ordinal:
            out += f", ordinal: {self.ordinal}"
        return out + ")"


class FindingKind(IntEnum):
    pass


@unique
class ComparatorFindingKind(FindingKind):
    Unknown = auto()

    # The instances of a particular model did not maintain total ordering of pks (that is, pks did not appear in ascending order, or appear multiple times).
    UnorderedInput = auto()

    # Multiple instances of the same custom ordinal signature exist in the input.
    DuplicateCustomOrdinal = auto()

    # The number of instances of a particular model on the left and right side of the input were not
    # equal.
    UnequalCounts = auto()

    # The JSON of two instances of a model, after certain fields have been scrubbed by all applicable comparators, were not byte-for-byte equivalent.
    UnequalJSON = auto()

    # Failed to compare an auto suffixed field.
    AutoSuffixComparator = auto()

    # Failed to compare an auto suffixed field because one of the fields being compared was not
    # present or `None`.
    AutoSuffixComparatorExistenceCheck = auto()

    # Two datetime fields were not equal.
    DatetimeEqualityComparator = auto()

    # Failed to compare datetimes because one of the fields being compared was not present or
    # `None`.
    DatetimeEqualityComparatorExistenceCheck = auto()

    # The right side field's datetime value was not greater (ie, "newer") than the left side's.
    DateUpdatedComparator = auto()

    # Failed to compare datetimes because one of the fields being compared was not present or
    # `None`.
    DateUpdatedComparatorExistenceCheck = auto()

    # Email equality comparison failed.
    EmailObfuscatingComparator = auto()

    # Failed to compare emails because one of the fields being compared was not present or
    # `None`.
    EmailObfuscatingComparatorExistenceCheck = auto()

    # Hash equality comparison failed.
    HashObfuscatingComparator = auto()

    # Failed to compare hashes because one of the fields being compared was not present or
    # `None`.
    HashObfuscatingComparatorExistenceCheck = auto()

    # Foreign key field comparison failed.
    ForeignKeyComparator = auto()

    # Failed to compare foreign key fields because one of the fields being compared was not present
    # or `None`.
    ForeignKeyComparatorExistenceCheck = auto()

    # Failed to compare an ignored field.
    IgnoredComparator = auto()

    # Secret token fields did not match their regex specification.
    SecretHexComparator = auto()

    # Failed to compare a secret token field because one of the fields being compared was not
    # present or `None`.
    SecretHexComparatorExistenceCheck = auto()

    # Subscription ID fields did not match their regex specification.
    SubscriptionIDComparator = auto()

    # Failed to compare a subscription id field because one of the fields being compared was not
    # present or `None`.
    SubscriptionIDComparatorExistenceCheck = auto()

    # Unordered list fields did not match.
    UnorderedListComparator = auto()

    # Failed to compare a unordered list field because one of the fields being compared was not
    # present or `None`.
    UnorderedListComparatorExistenceCheck = auto()

    # UUID4 fields did not match their regex specification.
    UUID4Comparator = auto()

    # Failed to compare a UUID4 field because one of the fields being compared was not present or
    # `None`.
    UUID4ComparatorExistenceCheck = auto()

    # Incorrect user password field.
    UserPasswordObfuscatingComparator = auto()

    # Failed to compare a user password field because one of the fields being compared was not
    # present or `None`.
    UserPasswordObfuscatingComparatorExistenceCheck = auto()


@dataclass(frozen=True)
class Finding(ABC):
    """
    A JSON serializable and user-reportable finding for an import/export operation. Don't use this
    class directly - inherit from it, set a specific `kind` type, and define your own pretty
    printer!
    """

    on: InstanceID

    # The original `pk` of the model in question, if one is specified in the `InstanceID`.
    left_pk: Optional[int] = None

    # The post-import `pk` of the model in question, if one is specified in the `InstanceID`.
    right_pk: Optional[int] = None

    reason: str = ""

    def get_finding_name(self) -> str:
        return self.__class__.__name__

    def _pretty_inner(self) -> str:
        """
        Pretty print only the fields on the shared `Finding` portion.
        """

        out = f"\n    on: {self.on.pretty()}"
        if self.left_pk:
            out += f",\n    left_pk: {self.left_pk}"
        if self.right_pk:
            out += f",\n    right_pk: {self.right_pk}"
        if self.reason:
            out += f",\n    reason: {self.reason}"
        return out

    @abstractmethod
    def pretty(self) -> str:
        pass

    @abstractmethod
    def to_dict(self) -> dict[str, Any]:
        pass


@dataclass(frozen=True)
class ComparatorFinding(Finding):
    """
    Store all information about a single failed matching between expected and actual output.
    """

    kind: ComparatorFindingKind = ComparatorFindingKind.Unknown

    def pretty(self) -> str:
        return f"ComparatorFinding(\n    kind: {self.kind.name},{self._pretty_inner()}\n)"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ComparatorFindings:
    """A wrapper type for a list of 'ComparatorFinding' which enables pretty-printing in asserts."""

    def __init__(self, findings: List[ComparatorFinding]):
        self.findings = findings

    def append(self, finding: ComparatorFinding) -> None:
        self.findings.append(finding)

    def empty(self) -> bool:
        return not self.findings

    def extend(self, findings: List[ComparatorFinding]) -> None:
        self.findings += findings

    def pretty(self) -> str:
        return "\n".join(f.pretty() for f in self.findings)


class FindingJSONEncoder(json.JSONEncoder):
    """JSON serializer that handles findings properly."""

    def default(self, obj):
        if isinstance(obj, Finding):
            kind = getattr(obj, "kind", None)
            d = obj.to_dict()
            d["finding"] = obj.get_finding_name()
            if isinstance(kind, FindingKind):
                d["kind"] = kind.name
            elif isinstance(kind, str):
                d["kind"] = kind
            return d
        return super().default(obj)
