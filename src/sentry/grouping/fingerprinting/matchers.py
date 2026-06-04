from __future__ import annotations

import logging
from typing import Any, Self

from sentry.grouping.fingerprinting.exceptions import InvalidFingerprintingConfig
from sentry.grouping.utils import bool_from_string
from sentry.utils.glob import glob_match

logger = logging.getLogger("sentry.events.grouping")


MATCHERS = {
    # discover field names
    "error.type": "type",
    "error.value": "value",
    "stack.module": "module",
    "stack.abs_path": "path",
    "stack.package": "package",
    "stack.function": "function",
    "message": "message",
    "logger": "logger",
    "level": "level",
    # fingerprinting shortened fields
    "type": "type",
    "value": "value",
    "module": "module",
    "path": "path",
    "package": "package",
    "function": "function",
    # fingerprinting specific fields
    "family": "family",
    "app": "app",
    "sdk": "sdk",
    "release": "release",
}


class FingerprintMatcher:
    def __init__(
        self,
        key: str,  # The event attribute on which to match
        pattern: str,  # The value to match (or to not match, depending on `negated`)
        negated: bool = False,  # If True, match when `event[key]` does NOT equal `pattern`
    ) -> None:
        if key.startswith("tags."):
            self.key = key
        else:
            try:
                self.key = MATCHERS[key]
            except KeyError:
                raise InvalidFingerprintingConfig("Unknown matcher '%s'" % key)
        self.pattern = pattern
        self.negated = negated

    @property
    def match_type(self) -> str:
        if self.key == "message":
            return "toplevel"
        if self.key in ("logger", "level"):
            return "log_info"
        if self.key in ("type", "value"):
            return "exceptions"
        if self.key.startswith("tags."):
            return "tags"
        if self.key == "sdk":
            return "sdk"
        if self.key == "family":
            return "family"
        if self.key == "release":
            return "release"
        return "frames"

    def matches(self, event_values: dict[str, Any]) -> bool:
        match_found = self._positive_match(event_values)
        return not match_found if self.negated else match_found

    def _positive_path_match(self, value: str | None) -> bool:
        if value is None:
            return False
        if glob_match(value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True):
            return True
        if not value.startswith("/") and glob_match(
            "/" + value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True
        ):
            return True
        return False

    def _positive_match(self, event_values: dict[str, Any]) -> bool:
        # Handle cases where `self.key` isn't 1-to-1 with the corresponding key in `event_values`
        if self.key == "path":
            return any(
                self._positive_path_match(value)
                # Use a set so that if the values match, we don't needlessly check both
                for value in {event_values.get("abs_path"), event_values.get("filename")}
            )

        if self.key == "message":
            return any(
                value is not None and glob_match(value, self.pattern, ignorecase=True)
                # message tests against exception value also, as this is what users expect
                for value in [event_values.get("message"), event_values.get("value")]
            )

        # For the rest, `self.key` matches the key in `event_values`
        value = event_values.get(self.key)

        if value is None:
            return False

        if self.key in ["package", "release"]:
            return self._positive_path_match(value)

        if self.key in ["family", "sdk"]:
            flags = self.pattern.split(",")
            return "all" in flags or value in flags

        if self.key == "app":
            return value == bool_from_string(self.pattern)

        if self.key in ["level", "value"]:
            return glob_match(value, self.pattern, ignorecase=True)

        return glob_match(value, self.pattern, ignorecase=False)

    def _to_config_structure(self) -> list[str]:
        key = self.key
        if self.negated:
            key = "!" + key
        return [key, self.pattern]

    @classmethod
    def _from_config_structure(cls, matcher: list[str]) -> Self:
        key, pattern = matcher

        negated = key.startswith("!")
        key = key.lstrip("!")

        return cls(key, pattern, negated)

    @property
    def text(self) -> str:
        return '{}{}:"{}"'.format(
            "!" if self.negated else "",
            self.key,
            self.pattern,
        )
