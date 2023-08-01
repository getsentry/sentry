from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Callable, Dict, List, Literal

from dateutil import parser

from sentry.backup.findings import ComparatorFinding, InstanceID
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
        self.fields = fields

    def check(self, side: str, data: JSONData) -> None:
        """Ensure that we have received valid JSON data at runtime."""

        if "model" not in data or not isinstance(data["model"], str):
            raise RuntimeError(f"The {side} input must have a `model` string assigned to it.")
        if "pk" not in data or not isinstance(data["pk"], int):
            raise RuntimeError(f"The {side} input must have a numerical `pk` entry.")
        if "fields" not in data or not isinstance(data["fields"], dict):
            raise RuntimeError(f"The {side} input must have a `fields` dictionary.")

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
                        kind=self.get_kind(),
                        on=on,
                        reason=f"the left {f} value on `{on}` was missing",
                    )
                )
            if f not in right["fields"]:
                findings.append(
                    ComparatorFinding(
                        kind=self.get_kind(),
                        on=on,
                        reason=f"the right {f} value on `{on}` was missing",
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

        self.check("left", left)
        self.check("right", right)
        if "scrubbed" not in left:
            left["scrubbed"] = {}
        if "scrubbed" not in right:
            right["scrubbed"] = {}

        for field in self.fields:
            for side in [left, right]:
                if field not in side["fields"]:
                    continue
                value = side["fields"][field]
                if not value:
                    continue
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
        if f not in left["fields"] and f not in right["fields"]:
            return []

        left_date_updated = left["fields"][f]
        right_date_updated = right["fields"][f]
        if parser.parse(left_date_updated) > parser.parse(right_date_updated):
            return [
                ComparatorFinding(
                    kind=self.get_kind(),
                    on=on,
                    reason=f"""the left date_updated value on `{on}` ({left_date_updated}) was not
                            less than or equal to the right ({right_date_updated})""",
                )
            ]
        return []


class ObfuscatingComparator(JSONScrubbingComparator, ABC):
    """Comparator that compares private values, but then safely truncates them to ensure that they
    do not leak out in logs, stack traces, etc."""

    def __init__(self, *fields: str):
        super().__init__(*fields)

    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> list[ComparatorFinding]:
        findings = []
        for f in self.fields:
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
                        reason=f"""the left `{f}` value ("{lv}") on `{on}` was not equal to the
                                right value ("{rv}")""",
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
            if len(d) >= 16:
                truncated.append(f"{d[:3]}...{d[-3:]}")
            elif len(d) >= 8:
                truncated.append(f"{d[:1]}...{d[-1:]}")
            elif len(d):
                truncated.append("...")
        return truncated


ComparatorList = List[JSONScrubbingComparator]
ComparatorMap = Dict[str, ComparatorList]
DEFAULT_COMPARATORS: ComparatorMap = {
    "sentry.apitoken": [
        EmailObfuscatingComparator("user"),
        HashObfuscatingComparator("refresh_token", "token"),
    ],
    "sentry.apiapplication": [
        EmailObfuscatingComparator("owner"),
        HashObfuscatingComparator("client_id", "client_secret"),
    ],
    "sentry.apiauthorization": [
        EmailObfuscatingComparator("user"),
    ],
    "sentry.authidentity": [
        EmailObfuscatingComparator("user"),
        HashObfuscatingComparator("ident", "token"),
    ],
    "sentry.authenticator": [EmailObfuscatingComparator("user")],
    "sentry.email": [EmailObfuscatingComparator("email")],
    "sentry.alertrule": [DateUpdatedComparator("date_modified")],
    "sentry.incidenttrigger": [DateUpdatedComparator("date_modified")],
    "sentry.orgauthtoken": [HashObfuscatingComparator("token_hashed", "token_last_characters")],
    "sentry.organizationmember": [
        EmailObfuscatingComparator("user_email"),
        HashObfuscatingComparator("token"),
    ],
    "sentry.projectkey": [HashObfuscatingComparator("public_key", "secret_key")],
    "sentry.querysubscription": [DateUpdatedComparator("date_updated")],
    "sentry.relay": [HashObfuscatingComparator("relay_id", "public_key")],
    "sentry.relayusage": [HashObfuscatingComparator("relay_id", "public_key")],
    "sentry.sentryapp": [EmailObfuscatingComparator("creator_user", "creator_label", "proxy_user")],
    "sentry.servicehook": [HashObfuscatingComparator("secret")],
    "sentry.user": [
        EmailObfuscatingComparator("email", "username"),
        HashObfuscatingComparator("password"),
    ],
    "sentry.useremail": [
        EmailObfuscatingComparator("email", "user"),
        HashObfuscatingComparator("validation_hash"),
    ],
    "sentry.userip": [EmailObfuscatingComparator("user")],
    "sentry.useroption": [EmailObfuscatingComparator("user")],
    "sentry.userpermission": [EmailObfuscatingComparator("user")],
    "sentry.userrole": [DateUpdatedComparator("date_updated")],
    "sentry.userroleuser": [
        DateUpdatedComparator("date_updated"),
        EmailObfuscatingComparator("user"),
    ],
}
