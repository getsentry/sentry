from __future__ import annotations

from typing import TypedDict

from sentry.grouping.fingerprinting import FingerprintRule
from sentry.grouping.utils import hash_from_values, is_default_fingerprint_var
from sentry.types.misc import KeyedList


class BaseVariant:
    # The type of the variant that is reported to the UI.
    type: str | None = None

    # This is true if `get_hash` does not return `None`.
    contributes = True

    def get_hash(self) -> str | None:
        return None

    @property
    def description(self):
        return self.type

    def _get_metadata_as_dict(self):
        return {}

    def as_dict(self):
        rv = {"type": self.type, "description": self.description, "hash": self.get_hash()}
        rv.update(self._get_metadata_as_dict())
        return rv

    def __repr__(self):
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

    def _get_metadata_as_dict(self):
        return {"checksum": self.checksum}


class HashedChecksumVariant(ChecksumVariant):
    type = "hashed_checksum"
    description = "hashed legacy checksum"

    def __init__(self, checksum: str, raw_checksum: str):
        self.checksum = checksum
        self.raw_checksum = raw_checksum

    def _get_metadata_as_dict(self):
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

    def __init__(self, event_performance_problem):
        self.event_performance_problem = event_performance_problem
        self.problem = event_performance_problem.problem

    def get_hash(self) -> str | None:
        return self.problem.fingerprint

    def _get_metadata_as_dict(self):
        problem_data = self.problem.to_dict()
        evidence_hashes = self.event_performance_problem.evidence_hashes

        return {"evidence": {**problem_data, **evidence_hashes}}


class ComponentVariant(BaseVariant):
    """A component variant is a variant that produces a hash from the
    `BaseGroupingComponent` it encloses.
    """

    type = "component"

    def __init__(self, component, config):
        self.component = component
        self.config = config

    @property
    def description(self):
        return self.component.description

    @property
    def contributes(self):
        return self.component.contributes

    def get_hash(self) -> str | None:
        return self.component.get_hash()

    def _get_metadata_as_dict(self):
        return {"component": self.component.as_dict(), "config": self.config.as_dict()}

    def __repr__(self):
        return super().__repr__() + f" contributes={self.contributes} ({self.description})"


def expose_fingerprint_dict(values, info):
    rv = {
        "values": values,
    }

    client_values = info.get("client_fingerprint")
    if client_values and (
        len(client_values) != 1 or not is_default_fingerprint_var(client_values[0])
    ):
        rv["client_values"] = client_values

    matched_rule = info.get("matched_rule")
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

    def __init__(self, values, fingerprint_info):
        self.values = values
        self.info = fingerprint_info

    @property
    def description(self):
        return "custom fingerprint"

    def get_hash(self) -> str | None:
        return hash_from_values(self.values)

    def _get_metadata_as_dict(self):
        return expose_fingerprint_dict(self.values, self.info)


class BuiltInFingerprintVariant(CustomFingerprintVariant):
    """A built-in, Sentry defined fingerprint."""

    type = "built_in_fingerprint"

    @property
    def description(self):
        return "Sentry defined fingerprint"


class SaltedComponentVariant(ComponentVariant):
    """A salted version of a component."""

    type = "salted_component"

    def __init__(self, values, component, config, fingerprint_info):
        ComponentVariant.__init__(self, component, config)
        self.values = values
        self.info = fingerprint_info

    @property
    def description(self):
        return "modified " + self.component.description

    def get_hash(self) -> str | None:
        if not self.component.contributes:
            return None
        final_values = []
        for value in self.values:
            if is_default_fingerprint_var(value):
                final_values.extend(self.component.iter_values())
            else:
                final_values.append(value)
        return hash_from_values(final_values)

    def _get_metadata_as_dict(self):
        rv = ComponentVariant._get_metadata_as_dict(self)
        rv.update(expose_fingerprint_dict(self.values, self.info))
        return rv


class VariantsByDescriptor(TypedDict, total=False):
    system: ComponentVariant
    app: ComponentVariant
    custom_fingerprint: CustomFingerprintVariant
    built_in_fingerprint: BuiltInFingerprintVariant
    checksum: ChecksumVariant
    hashed_checksum: HashedChecksumVariant
    default: ComponentVariant
    fallback: FallbackVariant
