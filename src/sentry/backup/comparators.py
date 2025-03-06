from __future__ import annotations

import re
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Callable
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from dateutil import parser
from django.db import models

from sentry.backup.dependencies import (
    PrimaryKeyMap,
    dependencies,
    get_exportable_sentry_models,
    get_model_name,
)
from sentry.backup.findings import ComparatorFinding, ComparatorFindingKind, InstanceID
from sentry.backup.helpers import Side

UNIX_EPOCH = unix_zero_date = datetime.fromtimestamp(0, timezone.utc).isoformat()


class ScrubbedData:
    """A singleton class used to indicate data has been scrubbed, without indicating what that data
    is. A unit type indicating "scrubbing was successful" only."""

    instance: ScrubbedData

    def __new__(cls):
        if getattr(cls, "instance", None) is None:
            cls.instance = super().__new__(cls)
        return cls.instance


class JSONScrubbingComparator(ABC):
    """An abstract class that compares and then scrubs some set of fields that, by a more nuanced
    definition than mere strict byte-for-byte equality, are expected to maintain some relation on
    otherwise equivalent JSON instances of the same model.

    Each class inheriting from `JSONScrubbingComparator` should override the abstract `compare`
    method with its own comparison logic. The `scrub` method merely moves the compared fields from
    the `fields` dictionary to the non-diffed `scrubbed` dictionary, and may optionally be wrapped
    if extra scrubbing logic is necessary.

    If multiple comparators are used sequentially on a single model (see the `SCRUBBING_COMPARATORS`
    dict below for specific mappings), all of the `compare(...)` methods are called before any of
    the `scrub(...)` methods are. This ensures that comparators that touch the same fields do not
    have their inputs mangled by one another."""

    def __init__(self, *fields: str):
        self.fields = set(fields)

    def check(self, side: Side, data: Any) -> None:
        """Ensure that we have received valid JSON data at runtime."""

        if "model" not in data or not isinstance(data["model"], str):
            raise RuntimeError(f"The {side.name} input must have a `model` string assigned to it.")
        if "ordinal" not in data or not isinstance(data["ordinal"], int):
            raise RuntimeError(f"The {side.name} input must have a numerical `ordinal` entry.")
        if "fields" not in data or not isinstance(data["fields"], dict):
            raise RuntimeError(f"The {side.name} input must have a `fields` dictionary.")

    @abstractmethod
    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        """An abstract method signature, to be implemented by inheriting classes with their own
        comparison logic. Implementations of this method MUST take care not to mutate the method's
        inputs!"""

    def existence(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        """Ensure that all tracked fields on either both models or neither."""

        findings = []
        for f in self.fields:
            missing_on_left = f not in left["fields"] or left["fields"][f] is None
            missing_on_right = f not in right["fields"] or right["fields"][f] is None
            if missing_on_left and missing_on_right:
                continue
            if missing_on_left:
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind_existence_check(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"the left `{f}` value was missing",
                    )
                )
            if missing_on_right:
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind_existence_check(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"the right `{f}` value was missing",
                    )
                )
        return findings

    def __scrub__(
        self,
        left: Any,
        right: Any,
        f: (
            Callable[[list[str]], list[str]] | Callable[[list[str]], ScrubbedData]
        ) = lambda _: ScrubbedData(),
    ) -> None:
        """Removes all of the fields compared by this comparator from the `fields` dict, so that the
        remaining fields may be compared for equality. Public callers should use the inheritance-safe wrapper, `scrub`, rather than using this internal method directly.

        Parameters:
        - on: An `InstanceID` that must be shared by both versions of the JSON model being compared.
        - left: One of the models being compared (usually the "before") version.
        - right: The other model it is being compared against (usually the "after" or
            post-processed version).
        - f: Optional helper method that populates the RHS of the scrubbed entry. If this is
            omitted, the scrubbed entry defaults to `True`.
        """

        self.check(Side.left, left)
        self.check(Side.right, right)
        if "scrubbed" not in left:
            left["scrubbed"] = {}
        if "scrubbed" not in right:
            right["scrubbed"] = {}

        for field in self.fields:
            for side in [left, right]:
                if side["fields"].get(field) is None:
                    # Normalize fields that are literally `None` vs those that are totally absent.
                    if field in side["fields"]:
                        del side["fields"][field]
                        side["scrubbed"][f"{self.get_kind().name}::{field}"] = None
                    continue
                value = side["fields"][field]
                value = [value] if not isinstance(value, list) else value
                del side["fields"][field]
                side["scrubbed"][f"{self.get_kind().name}::{field}"] = f(value)

    def scrub(
        self,
        left: Any,
        right: Any,
    ) -> None:
        self.__scrub__(left, right)

    def get_kind(self) -> ComparatorFindingKind:
        """A unique identifier for this particular derivation of JSONScrubbingComparator, which will
        be bubbled up in ComparatorFindings when they are generated."""

        return ComparatorFindingKind.__members__[self.__class__.__name__]

    def get_kind_existence_check(self) -> ComparatorFindingKind:
        """A unique identifier for the existence check of this particular derivation of
        JSONScrubbingComparator, which will be bubbled up in ComparatorFindings when they are
        generated."""

        return ComparatorFindingKind.__members__[self.__class__.__name__ + "ExistenceCheck"]


class AutoSuffixComparator(JSONScrubbingComparator):
    """Certain globally unique fields, like usernames and organization slugs, have special behavior
    when they encounter conflicts on import: rather than aborting, they simply generate a new
    placeholder value, with a random suffix on the end of the conflicting submission (ex: "my-org"
    becomes "my-org-1k1j"). This comparator is robust to such fields, and ensures that the left
    field entry is a strict prefix of the right."""

    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            if left["fields"].get(f) is None and right["fields"].get(f) is None:
                continue

            left_entry = left["fields"][f]
            right_entry = right["fields"][f]
            equal = left_entry == right_entry
            startswith = right_entry.startswith(left_entry + "-")
            if not equal and not startswith:
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"""the left value ({left_entry}) of `{f}` was not equal to or a dashed prefix of the right value ({right_entry})""",
                    )
                )
        return findings


class DateUpdatedComparator(JSONScrubbingComparator):
    """Comparator that ensures that the specified fields' value on the right input is an ISO-8601
    date that is greater than (ie, occurs after) or equal to the specified field's left input."""

    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            if left["fields"].get(f) is None and right["fields"].get(f) is None:
                continue

            left_date_updated = left["fields"][f] or UNIX_EPOCH
            right_date_updated = right["fields"][f] or UNIX_EPOCH
            if parser.parse(left_date_updated) > parser.parse(right_date_updated):
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"""the left value ({left_date_updated}) of `{f}` was not less than or equal to the right value ({right_date_updated})""",
                    )
                )
        return findings


class DatetimeEqualityComparator(JSONScrubbingComparator):
    """Some exports from before sentry@23.7.1 may trim milliseconds from timestamps if they end in
    exactly `.000` (ie, not milliseconds at all - what are the odds!). Because comparisons may fail
    in this case, we use a special comparator for these cases."""

    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            if left["fields"].get(f) is None and right["fields"].get(f) is None:
                continue

            left_date_added = left["fields"][f]
            right_date_added = right["fields"][f]
            if parser.parse(left_date_added) != parser.parse(right_date_added):
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"""the left value ({left_date_added}) of `{f}` was not equal to the right value ({right_date_added})""",
                    )
                )
        return findings


class ForeignKeyComparator(JSONScrubbingComparator):
    """Ensures that foreign keys match in a relative (they refer to the same other model in their
    respective JSON blobs) rather than absolute (they have literally the same integer value)
    sense."""

    left_pk_map: PrimaryKeyMap | None = None
    right_pk_map: PrimaryKeyMap | None = None

    def __init__(self, foreign_fields: dict[str, type[models.base.Model]]):
        super().__init__(*(foreign_fields.keys()))
        self.foreign_fields = foreign_fields

    def set_primary_key_maps(self, left_pk_map: PrimaryKeyMap, right_pk_map: PrimaryKeyMap):
        """Call this function before running the comparator, to ensure that it has access to the latest mapping information for both sides of the comparison."""

        self.left_pk_map = left_pk_map
        self.right_pk_map = right_pk_map

    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            field_model_name = get_model_name(self.foreign_fields[f])
            if left["fields"].get(f) is None and right["fields"].get(f) is None:
                continue

            if self.left_pk_map is None or self.right_pk_map is None:
                raise RuntimeError("must call `set_primary_key_maps` before comparing")

            left_fk_as_ordinal = self.left_pk_map.get_pk(field_model_name, left["fields"][f])
            right_fk_as_ordinal = self.right_pk_map.get_pk(field_model_name, right["fields"][f])
            if left_fk_as_ordinal is None or right_fk_as_ordinal is None:
                if left_fk_as_ordinal is None:
                    findings.append(
                        ComparatorFinding(
                            kind=self.get_kind(),
                            on=on,
                            left_pk=left["pk"],
                            right_pk=right["pk"],
                            reason=f"""the left foreign key ordinal for `{f}` model with pk `{left["fields"][f]}` could not be found""",
                        )
                    )
                if right_fk_as_ordinal is None:
                    findings.append(
                        ComparatorFinding(
                            kind=self.get_kind(),
                            on=on,
                            left_pk=left["pk"],
                            right_pk=right["pk"],
                            reason=f"""the right foreign key ordinal for `{f}` model with pk `{right["fields"][f]}` could not be found""",
                        )
                    )
                continue

            if left_fk_as_ordinal != right_fk_as_ordinal:
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"""the left foreign key ordinal ({left_fk_as_ordinal}) for `{f}` was not equal to the right foreign key ordinal ({right_fk_as_ordinal})""",
                    )
                )
        return findings


class ObfuscatingComparator(JSONScrubbingComparator, ABC):
    """Comparator that compares private values, but then safely truncates them to ensure that they
    do not leak out in logs, stack traces, etc."""

    def __init__(self, *fields: str):
        super().__init__(*fields)

    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            if left["fields"].get(f) is None and right["fields"].get(f) is None:
                continue

            lv = left["fields"][f]
            rv = right["fields"][f]
            if lv != rv:
                lv = self.truncate([lv] if not isinstance(lv, list) else lv)[0]
                rv = self.truncate([rv] if not isinstance(rv, list) else rv)[0]
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"""the left value ("{lv}") of `{f}` was not equal to the right value ("{rv}")""",
                    )
                )
        return findings

    def scrub(
        self,
        left: Any,
        right: Any,
    ) -> None:
        super().__scrub__(left, right, self.truncate)

    @abstractmethod
    def truncate(self, data: list[str]) -> list[str]:
        """An abstract method signature which implements a specific truncation algorithm to do the
        actual obfuscation."""


class EmailObfuscatingComparator(ObfuscatingComparator):
    """Comparator that compares emails, but then safely truncates them to ensure that they
    do not leak out in logs, stack traces, etc."""

    def truncate(self, data: list[str]) -> list[str]:
        truncated = []
        for d in data:
            parts = d.split("@")
            if len(parts) == 2:
                username = parts[0]
                domain = parts[1]
                truncated.append(f"{username[0]}...@...{domain[-6:]}")
            else:
                truncated.append(d)
        return truncated


class HashObfuscatingComparator(ObfuscatingComparator):
    """Comparator that compares hashed values like keys and tokens, but then safely truncates
    them to ensure that they do not leak out in logs, stack traces, etc."""

    def truncate(self, data: list[str]) -> list[str]:
        truncated = []
        for d in data:
            length = len(d)
            if length >= 16:
                truncated.append(f"{d[:3]}...{d[-3:]}")
            elif length >= 8:
                truncated.append(f"{d[:1]}...{d[-1:]}")
            else:
                truncated.append("...")
        return truncated


class UserPasswordObfuscatingComparator(ObfuscatingComparator):
    """
    Comparator that safely truncates passwords to ensure that they do not leak out in logs, stack
    traces, etc. Additionally, it validates that the left and right "claimed" status is correct.
    Namely, we want the following behaviors:

    - If the left side is `is_unclaimed = True` but the right side is `is_unclaimed = False`, error.
    - If the right side is `is_unclaimed = True`, make sure the password has changed.
    - If the right side is `is_unclaimed = False`, make sure that the password stays the same.
    """

    def __init__(self):
        super().__init__("password")

    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        findings = []

        # Error case: there is no importing action that can "claim" a user.
        if left["fields"].get("is_unclaimed") and not right["fields"].get("is_unclaimed"):
            findings.append(
                ComparatorFinding(
                    kind=self.get_kind(),
                    on=on,
                    left_pk=left["pk"],
                    right_pk=right["pk"],
                    reason="""the left value of `is_unclaimed` was `True` but the right value was `False`, even though the act of importing cannot claim users""",
                )
            )

        # Old user, all fields must remain constant.
        if not right["fields"].get("is_unclaimed"):
            findings.extend(super().compare(on, left, right))
            return findings

        # New user, password must change.
        left_password = left["fields"]["password"]
        right_password = right["fields"]["password"]
        left_lpc = left["fields"].get("last_password_change") or UNIX_EPOCH
        right_lpc = right["fields"].get("last_password_change") or UNIX_EPOCH
        if left_password == right_password:
            left_pw_truncated = self.truncate(
                [left_password] if not isinstance(left_password, list) else left_password
            )[0]
            right_pw_truncated = self.truncate(
                [right_password] if not isinstance(right_password, list) else right_password
            )[0]
            findings.append(
                ComparatorFinding(
                    kind=self.get_kind(),
                    on=on,
                    left_pk=left["pk"],
                    right_pk=right["pk"],
                    reason=f"""the left value ("{left_pw_truncated}") of `password` was equal to the
                            right value ("{right_pw_truncated}"), which is disallowed when
                            `is_unclaimed` is `True`""",
                )
            )

        # Ensure that the `last_password_change` field was not nulled or less than the left side.
        if parser.parse(left_lpc) > parser.parse(right_lpc):
            findings.append(
                ComparatorFinding(
                    kind=self.get_kind(),
                    on=on,
                    left_pk=left["pk"],
                    right_pk=right["pk"],
                    reason=f"""the left value ({left_lpc}) of `last_password_change` was not less than or equal to the right value ({right_lpc})""",
                )
            )

        if right["fields"].get("is_password_expired"):
            findings.append(
                ComparatorFinding(
                    kind=self.get_kind(),
                    on=on,
                    left_pk=left["pk"],
                    right_pk=right["pk"],
                    reason="""the right value of `is_password_expired` must be `False` for unclaimed
                           users""",
                )
            )

        return findings

    def truncate(self, data: list[str]) -> list[str]:
        truncated = []
        for d in data:
            length = len(d)
            if length > 80:
                # Retains algorithm identifying prefix, plus a few characters on the end.
                truncated.append(f"{d[:12]}...{d[-6:]}")
            elif length > 40:
                # Smaller hashes expose less information
                truncated.append(f"{d[:6]}...{d[-4:]}")
            else:
                # Very small hashes expose no information at all.
                truncated.append("...")
        return truncated


class IgnoredComparator(JSONScrubbingComparator):
    """Ensures that two fields are tested for mutual existence, and nothing else.

    Using this class means that you are foregoing comparing the relevant field(s), so please make
    sure you are validating them some other way!
    """

    def compare(self, _o: InstanceID, _l: Any, _r: Any) -> list[ComparatorFinding]:
        """Noop - there is nothing to compare once we've checked for existence."""

        return []

    def existence(self, _o: InstanceID, _l: Any, _r: Any) -> list[ComparatorFinding]:
        """Noop - never compare existence for ignored fields, they're ignored after all."""

        return []


class RegexComparator(JSONScrubbingComparator, ABC):
    """Comparator that ensures that both sides match a certain regex."""

    def __init__(self, regex: re.Pattern, *fields: str):
        self.regex = regex
        super().__init__(*fields)

    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            if left["fields"].get(f) is None and right["fields"].get(f) is None:
                continue

            lv = left["fields"][f]
            if not self.regex.fullmatch(lv):
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"""the left value ("{lv}") of `{f}` was not matched by this regex: {self.regex.pattern}""",
                    )
                )

            rv = right["fields"][f]
            if not self.regex.fullmatch(rv):
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"""the right value ("{rv}") of `{f}` was not matched by this regex: {self.regex.pattern}""",
                    )
                )
        return findings


class EqualOrRemovedComparator(JSONScrubbingComparator):
    """
    A normal equality comparison, except that it allows the right-side value to be `None` or
    missing.
    """

    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            if left["fields"].get(f) is None and right["fields"].get(f) is None:
                continue
            if right["fields"].get(f) is None:
                continue

            lv = left["fields"][f]
            rv = right["fields"][f]
            if lv != rv:
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"""the left value ("{lv}") of `{f}` was not equal to the right value ("{rv}")""",
                    )
                )

        return findings

    def existence(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        """Ensure that all tracked fields on either both models or neither."""

        findings = []
        for f in self.fields:
            missing_on_left = f not in left["fields"] or left["fields"][f] is None
            missing_on_right = f not in right["fields"] or right["fields"][f] is None
            if missing_on_left and missing_on_right:
                continue
            if missing_on_left:
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind_existence_check(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"the left `{f}` value was missing",
                    )
                )
        return findings


class SecretHexComparator(RegexComparator):
    """Certain 16-byte hexadecimal API keys are regenerated during an import operation."""

    def __init__(self, bytes: int, *fields: str):
        super().__init__(re.compile(f"""^[0-9a-f]{{{bytes * 2}}}$"""), *fields)


class SubscriptionIDComparator(RegexComparator):
    """Compare the basic format of `QuerySubscription` IDs, which is basically a UUID1 with a
    numeric prefix. Ensure that the two values are NOT equivalent."""

    def __init__(self, *fields: str):
        super().__init__(re.compile("^\\d+/[0-9a-f]{32}$"), *fields)

    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        # First, ensure that the two sides are not equivalent.
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            if left["fields"].get(f) is None and right["fields"].get(f) is None:
                continue

            lv = left["fields"][f]
            rv = right["fields"][f]
            if lv == rv:
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"""the left value ({lv}) of the subscription ID field `{f}` was
                                equal to the right value ({rv})""",
                    )
                )

        # Now, make sure both IDs' regex are valid.
        findings.extend(super().compare(on, left, right))
        return findings


class UnorderedListComparator(JSONScrubbingComparator):
    """Comparator for fields that are lists of unordered elements, which simply orders them before
    doing the comparison."""

    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            if left["fields"].get(f) is None and right["fields"].get(f) is None:
                continue

            lv = left["fields"][f] or []
            rv = right["fields"][f] or []
            if sorted(lv) != sorted(rv):
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"""the left value ({lv}) of the unordered list field `{f}` was not equal to the right value ({rv})""",
                    )
                )
        return findings


# Note: we could also use the `uuid` Python uuid module for this, but it is finicky and accepts some
# weird syntactic variations that are not very common and may cause weird failures when they are
# rejected elsewhere.
class UUID4Comparator(RegexComparator):
    """UUIDs must be regenerated on import (otherwise they would not be unique...). This comparator
    ensures that they retain their validity, but are not equivalent."""

    def __init__(self, *fields: str):
        super().__init__(
            re.compile(
                "^[a-f0-9]{8}-?[a-f0-9]{4}-?4[a-f0-9]{3}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12}\\Z$", re.I
            ),
            *fields,
        )

    def compare(self, on: InstanceID, left: Any, right: Any) -> list[ComparatorFinding]:
        # First, ensure that the two sides are not equivalent.
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            if left["fields"].get(f) is None and right["fields"].get(f) is None:
                continue

            lv = left["fields"][f]
            rv = right["fields"][f]
            if lv == rv:
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"""the left value ({lv}) of the UUID field `{f}` was equal to the right value ({rv})""",
                    )
                )

        # Now, make sure both UUIDs are valid.
        findings.extend(super().compare(on, left, right))
        return findings


def auto_assign_datetime_equality_comparators(comps: ComparatorMap) -> None:
    """Automatically assigns the DateAddedComparator to any `DateTimeField` that is not already
    claimed by the `DateUpdatedComparator`."""

    exportable = get_exportable_sentry_models()
    for e in exportable:
        name = str(get_model_name(e))
        fields = e._meta.get_fields()
        assign = set()
        for f in fields:
            if isinstance(f, models.DateTimeField) and name in comps:
                # Only auto assign the `DatetimeEqualityComparator` if this field is not mentioned
                # by a conflicting comparator.
                possibly_conflicting = [
                    e
                    for e in comps[name]
                    if isinstance(e, DateUpdatedComparator) or isinstance(e, IgnoredComparator)
                ]
                assign.add(f.name)
                for comp in possibly_conflicting:
                    if f.name in comp.fields:
                        assign.remove(f.name)

        if len(assign):
            found = next(
                filter(lambda e: isinstance(e, DatetimeEqualityComparator), comps[name]), None
            )
            if found:
                found.fields.update(assign)
            else:
                comps[name].append(DatetimeEqualityComparator(*assign))


def auto_assign_email_obfuscating_comparators(comps: ComparatorMap) -> None:
    """Automatically assigns the EmailObfuscatingComparator to any field that is an `EmailField` or
    has a foreign key into the `sentry.User` table."""

    exportable = get_exportable_sentry_models()
    for e in exportable:
        name = str(get_model_name(e))
        fields = e._meta.get_fields()
        assign = set()
        for f in fields:
            if isinstance(f, models.EmailField):
                assign.add(f.name)

        if len(assign):
            found = next(
                filter(lambda e: isinstance(e, EmailObfuscatingComparator), comps[name]),
                None,
            )
            if found:
                found.fields.update(assign)
            else:
                comps[name].append(EmailObfuscatingComparator(*assign))


def auto_assign_foreign_key_comparators(comps: ComparatorMap) -> None:
    """Automatically assigns the ForeignKeyComparator or to all appropriate model fields (see
    dependencies.py for more on what "appropriate" means in this context)."""

    for model_name, rels in dependencies().items():
        comps[str(model_name)].append(
            ForeignKeyComparator({k: v.model for k, v in rels.foreign_keys.items()})
        )


ComparatorList = list[JSONScrubbingComparator]
ComparatorMap = dict[str, ComparatorList]


# No arguments, so we lazily cache the result after the first calculation.
@lru_cache(maxsize=1)
def get_default_comparators() -> dict[str, list[JSONScrubbingComparator]]:
    """Helper function executed at startup time which builds the static default comparators map."""

    # Some comparators (like `DateAddedComparator`) we can automatically assign by inspecting the
    # `Field` type on the Django `Model` definition. Others, like the ones in this map, we must
    # assign manually, since there is no clever way to derive them automatically.
    default_comparators: ComparatorMap = defaultdict(
        list,
        {
            "sentry.apitoken": [
                HashObfuscatingComparator("refresh_token", "token"),
                # TODO: when we get rid of token/refresh_token for their hashed versions, and are
                # sure that none of the originals are left, we can compare these above. Until then,
                # just ignore them.
                IgnoredComparator("hashed_token", "hashed_refresh_token", "token_last_characters"),
                UnorderedListComparator("scope_list"),
            ],
            "sentry.apiapplication": [HashObfuscatingComparator("client_id", "client_secret")],
            "sentry.authidentity": [HashObfuscatingComparator("ident", "token")],
            "sentry.alertrule": [
                DateUpdatedComparator("date_modified"),
            ],
            "sentry.dashboardfavoriteuser": [
                DateUpdatedComparator("date_added", "date_updated"),
            ],
            "sentry.groupsearchview": [DateUpdatedComparator("date_updated")],
            "sentry.groupsearchviewlastvisited": [
                DateUpdatedComparator("last_visited", "date_added", "date_updated")
            ],
            "sentry.groupsearchviewstarred": [DateUpdatedComparator("date_updated", "date_added")],
            "sentry.groupsearchviewproject": [
                DateUpdatedComparator("date_updated"),
                DateUpdatedComparator("date_added"),
            ],
            "sentry.incident": [UUID4Comparator("detection_uuid")],
            "sentry.incidentactivity": [UUID4Comparator("notification_uuid")],
            "sentry.incidenttrigger": [DateUpdatedComparator("date_modified")],
            "sentry.integration": [DateUpdatedComparator("date_updated")],
            "sentry.monitor": [UUID4Comparator("guid")],
            "sentry.orgauthtoken": [
                HashObfuscatingComparator("token_hashed", "token_last_characters")
            ],
            "sentry.dashboardwidgetqueryondemand": [DateUpdatedComparator("date_modified")],
            "sentry.dashboardwidgetquery": [DateUpdatedComparator("date_modified")],
            "sentry.email": [DateUpdatedComparator("date_added")],
            "sentry.organization": [AutoSuffixComparator("slug")],
            "sentry.organizationintegration": [DateUpdatedComparator("date_updated")],
            "sentry.organizationmember": [
                HashObfuscatingComparator("token"),
            ],
            "sentry.projectkey": [
                HashObfuscatingComparator("public_key", "secret_key"),
                SecretHexComparator(16, "public_key", "secret_key"),
            ],
            "sentry.projecttemplate": [DateUpdatedComparator("date_updated")],
            "sentry.querysubscription": [
                DateUpdatedComparator("date_updated"),
                # We regenerate subscriptions when importing them, so even though all of the
                # particulars stay the same, the `subscription_id`s will be different.
                SubscriptionIDComparator("subscription_id"),
            ],
            "sentry.relay": [HashObfuscatingComparator("relay_id", "public_key")],
            "sentry.relayusage": [HashObfuscatingComparator("relay_id", "public_key")],
            "sentry.rollbackorganization": [DateUpdatedComparator("date_updated")],
            "sentry.rollbackuser": [
                UUID4Comparator("uuid", "share_uuid"),
                DateUpdatedComparator("date_updated"),
            ],
            "sentry.sentryapp": [
                DateUpdatedComparator("date_updated"),
                EmailObfuscatingComparator("creator_label"),
            ],
            "sentry.sentryappinstallation": [DateUpdatedComparator("date_updated")],
            "sentry.servicehook": [HashObfuscatingComparator("secret")],
            "sentry.team": [
                # TODO(getsentry/sentry#66247): Remove once self-hosted 24.4.0 is released.
                IgnoredComparator("org_role"),
            ],
            "sentry.user": [
                AutoSuffixComparator("username"),
                DateUpdatedComparator("last_active"),
                # `UserPasswordObfuscatingComparator` handles `last_password_change`,
                # `is_unclaimed`, `is_password_expired`, and `password` for us. Because of this, we
                # can ignore the `last_password_change`, `is_unclaimed`, and `is_password_expired`
                # fields otherwise and scrub them from the comparison.
                IgnoredComparator("last_password_change", "is_unclaimed", "is_password_expired"),
                UserPasswordObfuscatingComparator(),
            ],
            "sentry.useremail": [
                DateUpdatedComparator("date_hash_added"),
                IgnoredComparator("validation_hash", "is_verified"),
            ],
            "sentry.userip": [
                DateUpdatedComparator("first_seen", "last_seen"),
                # Incorrect country and region codes may be updated during an import, so we don't
                # want to compare them explicitly. This update is pulled from the geo IP service, so
                # we only really want to compare the IP address itself.
                IgnoredComparator("country_code", "region_code"),
            ],
            "sentry.userrole": [DateUpdatedComparator("date_updated")],
            "sentry.userroleuser": [DateUpdatedComparator("date_updated")],
            "workflow_engine.action": [DateUpdatedComparator("date_updated", "date_added")],
            "workflow_engine.actiongroupstatus": [
                DateUpdatedComparator("date_updated", "date_added")
            ],
            "workflow_engine.datacondition": [DateUpdatedComparator("date_updated", "date_added")],
            "workflow_engine.dataconditiongroup": [
                DateUpdatedComparator("date_updated", "date_added")
            ],
            "workflow_engine.dataconditiongroupaction": [
                DateUpdatedComparator("date_updated", "date_added")
            ],
            "workflow_engine.datasource": [DateUpdatedComparator("date_updated", "date_added")],
            "workflow_engine.datasourcedetector": [
                DateUpdatedComparator("date_updated", "date_added")
            ],
            "workflow_engine.detector": [DateUpdatedComparator("date_updated", "date_added")],
            "workflow_engine.detectorstate": [DateUpdatedComparator("date_updated", "date_added")],
            "workflow_engine.detectorworkflow": [
                DateUpdatedComparator("date_updated", "date_added")
            ],
            "workflow_engine.workflow": [DateUpdatedComparator("date_updated", "date_added")],
            "workflow_engine.workflowdataconditiongroup": [
                DateUpdatedComparator("date_updated", "date_added")
            ],
            "workflow_engine.alertruledetector": [
                DateUpdatedComparator("date_updated", "date_added")
            ],
            "workflow_engine.alertruleworkflow": [
                DateUpdatedComparator("date_updated", "date_added")
            ],
            "tempest.tempestcredentials": [
                DateUpdatedComparator("date_updated", "date_added"),
            ],
        },
    )

    # Where possible, we automatically deduce fields that should have special comparators and add
    # them to the `default_comparators` map.
    auto_assign_datetime_equality_comparators(default_comparators)
    auto_assign_email_obfuscating_comparators(default_comparators)
    auto_assign_foreign_key_comparators(default_comparators)

    return default_comparators
