from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, NotRequired, Self, TypedDict

from sentry.grouping.component import (
    AppGroupingComponent,
    ContributingComponent,
    DefaultGroupingComponent,
    SystemGroupingComponent,
)
from sentry.grouping.fingerprinting import FingerprintRule
from sentry.grouping.utils import hash_from_values, is_default_fingerprint_var
from sentry.types.misc import KeyedList

if TYPE_CHECKING:
    from sentry.grouping.api import FingerprintInfo
    from sentry.grouping.strategies.base import StrategyConfiguration


class FingerprintVariantMetadata(TypedDict):
    values: list[str]
    client_values: NotRequired[list[str]]
    matched_rule: NotRequired[str]


class BaseVariant(ABC):
    variant_name: str | None = None

    @property
    def contributes(self) -> bool:
        return True

    @property
    @abstractmethod
    def type(self) -> str: ...

    def get_hash(self) -> str | None:
        return None

    @property
    def description(self) -> str:
        return self.type

    # This has to return `Mapping` rather than `dict` so that subtypes can override the return value
    # with a TypedDict if they choose. See https://github.com/python/mypy/issues/4976.
    def _get_metadata_as_dict(self) -> Mapping[str, Any]:
        return {}

    def as_dict(self) -> dict[str, Any]:
        rv = {"type": self.type, "description": self.description, "hash": self.get_hash()}
        rv.update(self._get_metadata_as_dict())
        return rv

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} {self.get_hash()!r} ({self.type})>"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, BaseVariant):
            return NotImplemented
        return self.as_dict() == other.as_dict()


KeyedVariants = KeyedList[BaseVariant]


class ChecksumVariant(BaseVariant):
    """A checksum variant returns a single hardcoded hash."""

    type = "checksum"
    description = "legacy checksum"

    def __init__(self, checksum: str):
        self.checksum = checksum

    def get_hash(self) -> str | None:
        return self.checksum

    def _get_metadata_as_dict(self) -> Mapping[str, str]:
        return {"checksum": self.checksum}


class HashedChecksumVariant(ChecksumVariant):
    type = "hashed_checksum"
    description = "hashed legacy checksum"

    def __init__(self, checksum: str, raw_checksum: str):
        self.checksum = checksum
        self.raw_checksum = raw_checksum

    def _get_metadata_as_dict(self) -> Mapping[str, str]:
        return {"checksum": self.checksum, "raw_checksum": self.raw_checksum}


class FallbackVariant(BaseVariant):
    type = "fallback"
    contributes = True

    def get_hash(self) -> str | None:
        return hash_from_values([])


class PerformanceProblemVariant(BaseVariant):
    """
    Applies only to transaction events! Transactions are not subject to the
    normal grouping pipeline. Instead, they are fingerprinted by
    `PerformanceDetector` when the event is saved by `EventManager`. We detect
    problems, generate some metadata called "evidence" and use that evidence
    for fingerprinting. The evidence is then stored in `nodestore`. This
        variant's hash is delegated to the `EventPerformanceProblem` that
        contains the event and the evidence.
    """

    type = "performance_problem"
    description = "performance problem"
    contributes = True

    def __init__(self, event_performance_problem: Any):
        self.event_performance_problem = event_performance_problem
        self.problem = event_performance_problem.problem

    def get_hash(self) -> str | None:
        return self.problem.fingerprint

    def _get_metadata_as_dict(self) -> Mapping[str, Any]:
        problem_data = self.problem.to_dict()
        evidence_hashes = self.event_performance_problem.evidence_hashes

        return {"evidence": {**problem_data, **evidence_hashes}}


class ComponentVariant(BaseVariant):
    """A variant that produces a hash from the `BaseGroupingComponent` it encloses."""

    type = "component"

    def __init__(
        self,
        # The root of the component tree
        component: AppGroupingComponent | SystemGroupingComponent | DefaultGroupingComponent,
        # The highest non-root contributing component in the tree, representing the overall grouping
        # method (exception, threads, message, etc.). For non-contributing variants, this will be
        # None.
        contributing_component: ContributingComponent | None,
        strategy_config: StrategyConfiguration,
    ):
        self.component = component
        self.config = strategy_config
        self.contributing_component = contributing_component
        self.variant_name = self.component.id  # "app", "system", or "default"

    @property
    def description(self) -> str:
        return self.component.description

    @property
    def contributes(self) -> bool:
        return self.component.contributes

    def get_hash(self) -> str | None:
        return self.component.get_hash()

    def _get_metadata_as_dict(self) -> Mapping[str, Any]:
        return {"component": self.component.as_dict(), "config": self.config.as_dict()}

    def __repr__(self) -> str:
        return super().__repr__() + f" contributes={self.contributes} ({self.description})"


def expose_fingerprint_dict(
    fingerprint: list[str], fingerprint_info: FingerprintInfo
) -> FingerprintVariantMetadata:
    rv: FingerprintVariantMetadata = {
        "values": fingerprint,
    }

    client_fingerprint = fingerprint_info.get("client_fingerprint")
    if client_fingerprint and (
        len(client_fingerprint) != 1 or not is_default_fingerprint_var(client_fingerprint[0])
    ):
        rv["client_values"] = client_fingerprint

    matched_rule = fingerprint_info.get("matched_rule")
    if matched_rule:
        # TODO: Before late October 2024, we didn't store the rule text along with the matched rule,
        # meaning there are still events out there whose `_fingerprint_info` entry doesn't have it.
        # Once those events have aged out (in February or so), we can remove the default value here
        # and the `test_old_event_with_no_fingerprint_rule_text` test in `test_variants.py`.
        rv["matched_rule"] = matched_rule.get("text", FingerprintRule.from_json(matched_rule).text)

    return rv


class CustomFingerprintVariant(BaseVariant):
    """A user-defined custom fingerprint."""

    type = "custom_fingerprint"

    def __init__(self, fingerprint: list[str], fingerprint_info: FingerprintInfo):
        self.values = fingerprint
        self.info = fingerprint_info

    @property
    def description(self) -> str:
        return "custom fingerprint"

    def get_hash(self) -> str | None:
        return hash_from_values(self.values)

    def _get_metadata_as_dict(self) -> FingerprintVariantMetadata:
        return expose_fingerprint_dict(self.values, self.info)


class BuiltInFingerprintVariant(CustomFingerprintVariant):
    """A built-in, Sentry-defined fingerprint."""

    type = "built_in_fingerprint"

    @property
    def description(self) -> str:
        return "Sentry defined fingerprint"


class SaltedComponentVariant(ComponentVariant):
    """A salted version of a component."""

    type = "salted_component"

    @classmethod
    def from_component_variant(
        cls,
        component_variant: ComponentVariant,
        fingerprint: list[str],
        fingerprint_info: FingerprintInfo,
    ) -> Self:
        return cls(
            fingerprint=fingerprint,
            component=component_variant.component,
            contributing_component=component_variant.contributing_component,
            strategy_config=component_variant.config,
            fingerprint_info=fingerprint_info,
        )

    def __init__(
        self,
        fingerprint: list[str],
        # The root of the component tree
        component: AppGroupingComponent | SystemGroupingComponent | DefaultGroupingComponent,
        # The highest non-root contributing component in the tree, representing the overall grouping
        # method (exception, threads, message, etc.). For non-contributing variants, this will be
        # None.
        contributing_component: ContributingComponent | None,
        strategy_config: StrategyConfiguration,
        fingerprint_info: FingerprintInfo,
    ):
        ComponentVariant.__init__(self, component, contributing_component, strategy_config)
        self.values = fingerprint
        self.info = fingerprint_info

    @property
    def description(self) -> str:
        return "modified " + self.component.description

    def get_hash(self) -> str | None:
        if not self.component.contributes:
            return None
        final_values: list[str | int] = []
        for value in self.values:
            # If we've hit the `{{ default }}` part of the fingerprint, pull in values from the
            # original grouping method (message, stacktrace, etc.)
            if is_default_fingerprint_var(value):
                final_values.extend(self.component.iter_values())
            else:
                final_values.append(value)
        return hash_from_values(final_values)

    def _get_metadata_as_dict(self) -> Mapping[str, Any]:
        return {
            **ComponentVariant._get_metadata_as_dict(self),
            **expose_fingerprint_dict(self.values, self.info),
        }


class VariantsByDescriptor(TypedDict, total=False):
    system: ComponentVariant
    app: ComponentVariant
    custom_fingerprint: CustomFingerprintVariant
    built_in_fingerprint: BuiltInFingerprintVariant
    checksum: ChecksumVariant
    hashed_checksum: HashedChecksumVariant
    default: ComponentVariant
    fallback: FallbackVariant
