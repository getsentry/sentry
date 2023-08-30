from __future__ import annotations

from abc import ABC, abstractmethod
from collections import defaultdict
from functools import lru_cache
from typing import Callable, Dict, List, Type

from dateutil import parser
from django.db import models

from sentry.backup.dependencies import PrimaryKeyMap, dependencies
from sentry.backup.findings import ComparatorFinding, ComparatorFindingKind, InstanceID
from sentry.backup.helpers import Side, get_exportable_sentry_models
from sentry.models.team import Team
from sentry.models.user import User
from sentry.utils.json import JSONData


class ScrubbedData:
    """A singleton class used to indicate data has been scrubbed, without indicating what that data is. A unit type indicating "scrubbing was successful" only."""

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
                        kind=self.get_kind_existence_check(),
                        on=on,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason=f"the left `{f}` value was missing",
                    )
                )
            if f not in right["fields"]:
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
        left: JSONData,
        right: JSONData,
        f: Callable[[list[str]], list[str]]
        | Callable[[list[str]], ScrubbedData] = lambda _: ScrubbedData(),
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
                    continue
                value = side["fields"][field]
                value = [value] if not isinstance(value, list) else value
                del side["fields"][field]
                side["scrubbed"][f"{self.get_kind().name}::{field}"] = f(value)

    def scrub(
        self,
        left: JSONData,
        right: JSONData,
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


class DateUpdatedComparator(JSONScrubbingComparator):
    """Comparator that ensures that the specified field's value on the right input is an ISO-8601
    date that is greater than (ie, occurs after) or equal to the specified field's left input."""

    def __init__(self, field: str):
        super().__init__(field)
        self.field = field

    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> list[ComparatorFinding]:
        f = self.field
        if left["fields"].get(f) is None and right["fields"].get(f) is None:
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


class DatetimeEqualityComparator(JSONScrubbingComparator):
    """Some exports from before sentry@23.7.1 may trim milliseconds from timestamps if they end in
    exactly `.000` (ie, not milliseconds at all - what are the odds!). Because comparisons may fail
    in this case, we use a special comparator for these cases."""

    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> list[ComparatorFinding]:
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

    def __init__(self, foreign_fields: dict[str, Type[models.base.Model]]):
        super().__init__(*(foreign_fields.keys()))
        self.foreign_fields = foreign_fields

    def set_primary_key_maps(self, left_pk_map: PrimaryKeyMap, right_pk_map: PrimaryKeyMap):
        """Call this function before running the comparator, to ensure that it has access to the latest mapping information for both sides of the comparison."""

        self.left_pk_map = left_pk_map
        self.right_pk_map = right_pk_map

    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> list[ComparatorFinding]:
        findings = []
        fields = sorted(self.fields)
        for f in fields:
            obj_name = self.foreign_fields[f]._meta.object_name.lower()  # type: ignore[union-attr]
            field_model_name = "sentry." + obj_name
            if left["fields"].get(f) is None and right["fields"].get(f) is None:
                continue

            if self.left_pk_map is None or self.right_pk_map is None:
                raise RuntimeError("must call `set_primary_key_maps` before comparing")

            left_fk_as_ordinal = self.left_pk_map.get(field_model_name, left["fields"][f])
            right_fk_as_ordinal = self.right_pk_map.get(field_model_name, right["fields"][f])
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

    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> list[ComparatorFinding]:
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


class IgnoredComparator(JSONScrubbingComparator):
    """Ensures that two fields are tested for mutual existence, and nothing else.

    Using this class means that you are foregoing comparing the relevant field(s), so please make sure you are validating them some other way!"""

    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> list[ComparatorFinding]:
        """Noop - there is nothing to compare once we've checked for existence."""

        return []


def auto_assign_datetime_equality_comparators(comps: ComparatorMap) -> None:
    """Automatically assigns the DateAddedComparator to any `DateTimeField` that is not already claimed by the `DateUpdatedComparator`."""

    exportable = get_exportable_sentry_models()
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

        if len(assign):
            found = next(
                filter(lambda e: isinstance(e, DatetimeEqualityComparator), comps[name]), None
            )
            if found:
                found.fields.update(assign)
            else:
                comps[name].append(DatetimeEqualityComparator(*assign))


def auto_assign_email_obfuscating_comparators(comps: ComparatorMap) -> None:
    """Automatically assigns the EmailObfuscatingComparator to any field that is an `EmailField` or has a foreign key into the `sentry.User` table."""

    exportable = get_exportable_sentry_models()
    for e in exportable:
        name = "sentry." + e.__name__.lower()
        fields = e._meta.get_fields()
        assign = set()
        for f in fields:
            if isinstance(f, models.EmailField):
                assign.add(f.name)

        if len(assign):
            found = next(
                filter(lambda e: isinstance(e, EmailObfuscatingComparator), comps[name]), None
            )
            if found:
                found.fields.update(assign)
            else:
                comps[name].append(EmailObfuscatingComparator(*assign))


def auto_assign_foreign_key_comparators(comps: ComparatorMap) -> None:
    """Automatically assigns the ForeignKeyComparator or to all appropriate model fields (see
    dependencies.py for more on what "appropriate" means in this context)."""

    for model_name, rels in dependencies().items():
        comps[model_name.lower()].append(
            ForeignKeyComparator({k: v.model for k, v in rels.foreign_keys.items()})
        )


ComparatorList = List[JSONScrubbingComparator]
ComparatorMap = Dict[str, ComparatorList]


# No arguments, so we lazily cache the result after the first calculation.
@lru_cache(maxsize=1)
def get_default_comparators():
    """Helper function executed at startup time which builds the static default comparators map."""

    # Some comparators (like `DateAddedComparator`) we can automatically assign by inspecting the
    # `Field` type on the Django `Model` definition. Others, like the ones in this map, we must assign
    # manually, since there is no clever way to derive them automatically.
    default_comparators: ComparatorMap = defaultdict(
        list,
        {
            # TODO(hybrid-cloud): actor refactor. Remove this entry when done.
            "sentry.actor": [ForeignKeyComparator({"team": Team, "user_id": User})],
            "sentry.apitoken": [HashObfuscatingComparator("refresh_token", "token")],
            "sentry.apiapplication": [HashObfuscatingComparator("client_id", "client_secret")],
            "sentry.authidentity": [HashObfuscatingComparator("ident", "token")],
            "sentry.alertrule": [DateUpdatedComparator("date_modified")],
            "sentry.incidenttrigger": [DateUpdatedComparator("date_modified")],
            "sentry.orgauthtoken": [
                HashObfuscatingComparator("token_hashed", "token_last_characters")
            ],
            "sentry.organizationmember": [HashObfuscatingComparator("token")],
            "sentry.projectkey": [HashObfuscatingComparator("public_key", "secret_key")],
            "sentry.querysubscription": [DateUpdatedComparator("date_updated")],
            "sentry.relay": [HashObfuscatingComparator("relay_id", "public_key")],
            "sentry.relayusage": [HashObfuscatingComparator("relay_id", "public_key")],
            "sentry.sentryapp": [EmailObfuscatingComparator("creator_label")],
            "sentry.servicehook": [HashObfuscatingComparator("secret")],
            "sentry.user": [HashObfuscatingComparator("password")],
            "sentry.useremail": [
                DateUpdatedComparator("date_hash_added"),
                IgnoredComparator("validation_hash", "is_verified"),
            ],
            "sentry.userrole": [DateUpdatedComparator("date_updated")],
            "sentry.userroleuser": [DateUpdatedComparator("date_updated")],
        },
    )

    # Where possible, we automatically deduce fields that should have special comparators and add
    # them to the `default_comparators` map.
    auto_assign_datetime_equality_comparators(default_comparators)
    auto_assign_email_obfuscating_comparators(default_comparators)
    auto_assign_foreign_key_comparators(default_comparators)

    return default_comparators
