from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Callable, Dict, List, Literal

from dateutil import parser
from django.db import models

from sentry.backup.findings import ComparatorFinding, InstanceID
from sentry.backup.helpers import Side, get_exportable_final_derivations_of
from sentry.db.models import BaseModel
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.utils.json import JSONData


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

    def check(self, side: Side, data: JSONData) -> None:
        """Ensure that we have received valid JSON data at runtime."""

        if "model" not in data or not isinstance(data["model"], str):
            raise RuntimeError(f"The {side.name} input must have a `model` string assigned to it.")
        if "ordinal" not in data or not isinstance(data["ordinal"], int):
            raise RuntimeError(f"The {side.name} input must have a numerical `ordinal` entry.")
        if "fields" not in data or not isinstance(data["fields"], dict):
            raise RuntimeError(f"The {side.name} input must have a `fields` dictionary.")

    @abstractmethod
    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> list[ComparatorFinding]:
        """An abstract method signature, to be implemented by inheriting classes with their own
        comparison logic. Implementations of this method MUST take care not to mutate the method's
        inputs!"""

        pass

    def existence(self, on: InstanceID, left: JSONData, right: JSONData) -> list[ComparatorFinding]:
        """Ensure that all tracked fields on either both models or neither."""

        findings = []
        for f in self.fields:
            if f not in left["fields"] and f not in right["fields"]:
                continue
            if f not in left["fields"]:
                findings.append(
                    ComparatorFinding(
                        kind="Unexecuted" + self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"the left `{f}` value was missing",
                    )
                )
            if f not in right["fields"]:
                findings.append(
                    ComparatorFinding(
                        kind="Unexecuted" + self.get_kind(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"the right `{f}` value was missing",
                    )
                )
        return findings

    def __scrub__(
        self,
        left: JSONData,
        right: JSONData,
        f: Callable[[list[str]], list[str]] | Callable[[list[str]], Literal[True]] = lambda _: True,
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
                if not bool(side["fields"].get(field)):
                    continue
                value = side["fields"][field]
                value = [value] if isinstance(value, str) else value
                del side["fields"][field]
                side["scrubbed"][f"{self.get_kind()}::{field}"] = f(value)

    def scrub(
        self,
        left: JSONData,
        right: JSONData,
    ) -> None:
        self.__scrub__(left, right)

    def get_kind(self) -> str:
        """A unique identifier for this particular derivation of JSONScrubbingComparator, which will
        be bubbled up in ComparatorFindings when they are generated."""

        return self.__class__.__name__


class DateUpdatedComparator(JSONScrubbingComparator):
    """Comparator that ensures that the specified field's value on the right input is an ISO-8601
    date that is greater than (ie, occurs after) the specified field's left input."""

    def __init__(self, field: str):
        super().__init__(field)
        self.field = field

    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> list[ComparatorFinding]:
        f = self.field
        if not bool(left["fields"].get(f)) and not bool(right["fields"].get(f)):
            return []

        left_date_updated = left["fields"][f]
        right_date_updated = right["fields"][f]
        if parser.parse(left_date_updated) > parser.parse(right_date_updated):
            return [
                ComparatorFinding(
                    kind=self.get_kind(),
                    on=on,
                    left_pk=left["pk"],
                    right_pk=right["pk"],
                    reason=f"""the left value ({left_date_updated}) of `{f}` was not less than or equal to the right value ({right_date_updated})""",
                )
            ]
        return []


class DateAddedComparator(JSONScrubbingComparator):
    """Some exports from before sentry@23.7.1 may trim milliseconds from timestamps if they end in
    exactly `.000` (ie, not milliseconds at all - what are the odds!). Because comparisons may fail
    in this case, we use a special comparator for these cases."""

    def __init__(self, *fields: str):
        super().__init__(*fields)

    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> list[ComparatorFinding]:
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            if not bool(left["fields"].get(f)) and not bool(right["fields"].get(f)):
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


class ObfuscatingComparator(JSONScrubbingComparator, ABC):
    """Comparator that compares private values, but then safely truncates them to ensure that they
    do not leak out in logs, stack traces, etc."""

    def __init__(self, *fields: str):
        super().__init__(*fields)

    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> list[ComparatorFinding]:
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            if f not in left["fields"] and f not in right["fields"]:
                continue

            lv = left["fields"][f]
            rv = right["fields"][f]
            if lv != rv:
                lv = self.truncate([lv] if isinstance(lv, str) else lv)[0]
                rv = self.truncate([rv] if isinstance(rv, str) else rv)[0]
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
        left: JSONData,
        right: JSONData,
    ) -> None:
        super().__scrub__(left, right, self.truncate)

    @abstractmethod
    def truncate(self, data: list[str]) -> list[str]:
        """An abstract method signature which implements a specific truncation algorithm to do the
        actual obfuscation."""

        pass


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
    """Comparator that compares hashed values like keys and passwords, but then safely truncates
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


def auto_assign_date_added_comparator(comps: ComparatorMap) -> None:
    """Automatically assigns the DateAddedComparator to any `DateTimeField` that is not already claimed by the `DateUpdatedComparator`."""

    exportable = get_exportable_final_derivations_of(BaseModel)
    for e in exportable:
        name = "sentry." + e.__name__.lower()
        fields = e._meta.get_fields()
        assign = set()
        for f in fields:
            if isinstance(f, models.DateTimeField) and name in comps:
                date_updated_comparator = next(
                    filter(lambda e: isinstance(e, DateUpdatedComparator), comps[name]), None
                )
                if not date_updated_comparator or f.name not in date_updated_comparator.fields:
                    assign.add(f.name)

        if name in comps:
            found = next(filter(lambda e: isinstance(e, DateAddedComparator), comps[name]), None)
            if found:
                found.fields.update(assign)
            else:
                comps[name].append(DateAddedComparator(*assign))
        else:
            comps[name] = [DateAddedComparator(*assign)]


def auto_assign_email_obfuscating_comparator(comps: ComparatorMap) -> None:
    """Automatically assigns the EmailObfuscatingComparator to any field that is an `EmailField` or has a foreign key into the `sentry.User` table."""

    exportable = get_exportable_final_derivations_of(BaseModel)
    for e in exportable:
        name = "sentry." + e.__name__.lower()
        fields = e._meta.get_fields()
        assign = set()
        for f in fields:
            if isinstance(f, models.EmailField):
                assign.add(f.name)
            elif isinstance(f, FlexibleForeignKey) and f.related_model.__name__ == "User":
                assign.add(f.name)
            elif isinstance(f, models.OneToOneField) and f.related_model.__name__ == "User":
                assign.add(f.name)
            elif isinstance(f, models.ManyToManyField) and f.related_model.__name__ == "User":
                assign.add(f.name)

        if name in comps:
            found = next(
                filter(lambda e: isinstance(e, EmailObfuscatingComparator), comps[name]), None
            )
            if found:
                found.fields.update(assign)
            else:
                comps[name].append(EmailObfuscatingComparator(*assign))
        else:
            comps[name] = [EmailObfuscatingComparator(*assign)]


ComparatorList = List[JSONScrubbingComparator]
ComparatorMap = Dict[str, ComparatorList]

# Some comparators (like `DateAddedComparator`) we can automatically assign by inspecting the
# `Field` type on the Django `Model` definition. Others, like the ones in this map, we must assign
# manually, since there is no clever way to derive them automatically.
DEFAULT_COMPARATORS: ComparatorMap = {
    "sentry.apitoken": [HashObfuscatingComparator("refresh_token", "token")],
    "sentry.apiapplication": [HashObfuscatingComparator("client_id", "client_secret")],
    "sentry.authidentity": [HashObfuscatingComparator("ident", "token")],
    "sentry.alertrule": [DateUpdatedComparator("date_modified")],
    "sentry.incidenttrigger": [DateUpdatedComparator("date_modified")],
    "sentry.orgauthtoken": [HashObfuscatingComparator("token_hashed", "token_last_characters")],
    "sentry.organizationmember": [HashObfuscatingComparator("token")],
    "sentry.projectkey": [HashObfuscatingComparator("public_key", "secret_key")],
    "sentry.querysubscription": [DateUpdatedComparator("date_updated")],
    "sentry.relay": [HashObfuscatingComparator("relay_id", "public_key")],
    "sentry.relayusage": [HashObfuscatingComparator("relay_id", "public_key")],
    "sentry.sentryapp": [EmailObfuscatingComparator("creator_label")],
    "sentry.servicehook": [HashObfuscatingComparator("secret")],
    "sentry.user": [HashObfuscatingComparator("password")],
    "sentry.useremail": [HashObfuscatingComparator("validation_hash")],
    "sentry.userrole": [DateUpdatedComparator("date_updated")],
    "sentry.userroleuser": [DateUpdatedComparator("date_updated")],
}

# Where possible, we automatically deduce fields that should have special comparators and add them
# to the `DEFAULT_COMPARATORS` map.
auto_assign_date_added_comparator(DEFAULT_COMPARATORS)
auto_assign_email_obfuscating_comparator(DEFAULT_COMPARATORS)
