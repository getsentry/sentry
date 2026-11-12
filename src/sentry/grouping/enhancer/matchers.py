from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypedDict

from sentry.grouping.utils import bool_from_string
from sentry.stacktraces.functions import get_function_name_for_frame
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils import metrics

from .exceptions import InvalidEnhancerConfig

MATCH_KEYS = {
    "path": "p",
    "function": "f",
    "module": "m",
    "family": "F",
    "package": "P",
    "app": "a",
    "type": "t",
    "value": "v",
    "mechanism": "M",
    "category": "c",
}
SHORT_MATCH_KEYS = {v: k for k, v in MATCH_KEYS.items()}

assert len(SHORT_MATCH_KEYS) == len(MATCH_KEYS)  # assert short key names are not reused

FAMILIES = {"native": "N", "javascript": "J", "other": "O", "all": "a"}
REVERSE_FAMILIES = {v: k for k, v in FAMILIES.items()}


MATCHERS = {
    # discover field names
    "stack.module": "module",
    "stack.abs_path": "path",
    "stack.package": "package",
    "stack.function": "function",
    "error.type": "type",
    "error.value": "value",
    "error.mechanism": "mechanism",
    # fingerprinting shortened fields
    "module": "module",
    "path": "path",
    "package": "package",
    "function": "function",
    "type": "type",
    "value": "value",
    "mechanism": "mechanism",
    "category": "category",
    # fingerprinting-specific fields
    "family": "family",
    "app": "app",
}


class MatchFrame(TypedDict):
    category: bytes | None
    family: bytes | None
    function: bytes
    in_app: bool | None
    orig_in_app: int | None
    module: bytes | None
    package: bytes | None
    path: bytes | None


def _get_function_name(frame_data: dict[str, Any], platform: str | None) -> str:
    function_name = get_function_name_for_frame(frame_data, platform)

    return function_name or "<unknown>"


def _encode_if_str(value: str | bytes | None) -> bytes | None:
    return value.encode("utf-8") if isinstance(value, str) else value


def _normalize_path(value: str | bytes | None) -> bytes | None:
    # Path-like matchers are case-insensitive and use `/` as the file-system separator.
    encoded_value = _encode_if_str(value)
    if isinstance(encoded_value, bytes):
        return encoded_value.lower().replace(b"\\", b"/")
    return encoded_value


def create_match_frame(frame_data: dict[str, Any], platform: str | None) -> MatchFrame:
    """Create flat dict of values relevant to matchers"""
    frame_metadata = frame_data.get("data")
    if not isinstance(frame_metadata, Mapping):
        frame_metadata = {}

    category = _encode_if_str(frame_metadata.get("category"))
    module = _encode_if_str(frame_data.get("module"))

    package = _normalize_path(frame_data.get("package"))
    path = _normalize_path(frame_data.get("abs_path") or frame_data.get("filename"))

    return MatchFrame(
        category=category,
        family=get_behavior_family_for_platform(frame_data.get("platform") or platform).encode(
            "utf-8"
        ),
        function=_get_function_name(frame_data, platform).encode("utf-8"),
        in_app=frame_data.get("in_app"),
        orig_in_app=frame_metadata.get("orig_in_app"),
        module=module,
        package=package,
        path=path,
    )


class EnhancementMatch:
    key: str
    pattern: str

    @property
    def description(self) -> str:
        raise NotImplementedError()

    def _to_config_structure(self, version: int) -> str:
        raise NotImplementedError()

    @staticmethod
    def _from_config_structure(config_structure: str, version: int) -> EnhancementMatch:
        val = config_structure
        if val.startswith("|[") and val.endswith("]"):
            frame_match: Any = EnhancementMatch._from_config_structure(val[2:-1], version)
            return CalleeMatch(frame_match)
        if val.startswith("[") and val.endswith("]|"):
            frame_match = EnhancementMatch._from_config_structure(val[1:-2], version)
            return CallerMatch(frame_match)

        if val.startswith("!"):
            negated = True
            val = val[1:]
        else:
            negated = False
        key = SHORT_MATCH_KEYS[val[0]]
        if key == "family":
            arg = ",".join(_f for _f in [REVERSE_FAMILIES.get(x) for x in val[1:]] if _f)
        else:
            arg = val[1:]

        return FrameMatch.from_key(key, arg, negated)


InstanceKey = tuple[str, str, bool]


class FrameMatch(EnhancementMatch):
    # Global registry of matchers
    instances: dict[InstanceKey, FrameMatch] = {}

    @classmethod
    def from_key(cls, key: str, pattern: str, negated: bool) -> FrameMatch:
        instance_key = (key, pattern, negated)
        if instance_key in cls.instances:
            instance = cls.instances[instance_key]
        else:
            instance = cls.instances[instance_key] = cls(key, pattern, negated)
            metrics.gauge("grouping.enhancer.matchers.registry_size", len(cls.instances))

        return instance

    def __init__(self, key: str, pattern: str, negated: bool = False):
        super().__init__()
        try:
            self.key = MATCHERS[key]
        except KeyError:
            raise InvalidEnhancerConfig("Unknown matcher '%s'" % key)
        self.pattern = pattern
        self.negated = negated

    @property
    def description(self) -> str:
        pattern_contains_whitespace = self.pattern.split() != [self.pattern]
        return "{}{}:{}".format(
            "!" if self.negated else "",
            self.key,
            self.pattern if not pattern_contains_whitespace else f'"{self.pattern}"',
        )

    def _to_config_structure(self, version: int) -> str:
        """
        Convert the matcher into a string of the form
            <match_type><match_pattern>
        where
            match_type is a single letter code for the match type (see MATCH_KEYS)
            match_pattern is the value to match against

        This will be preceded by a `!` if the match is negated. Families against which to match are
        also converted to single-letter abbreviations, and in-app booleans are converted to 0 or 1.
        """
        # Convert the families to match into a string of single letter abbreviations (so
        # `javascript,native` becomes `JN`, for example)
        if self.key == "family":
            family_abbreviations = [FAMILIES.get(family) for family in self.pattern.split(",")]
            value_to_match = "".join(
                # Filter out Nones (which come from unrecognized families)
                [abbreviation for abbreviation in family_abbreviations if abbreviation]
            )
        elif self.key == "app":
            boolified_pattern = bool_from_string(self.pattern)
            value_to_match = (
                "1" if boolified_pattern is True else "0" if boolified_pattern is False else ""
            )
        else:
            value_to_match = self.pattern

        match_type_abbreviation = MATCH_KEYS[self.key]
        return ("!" if self.negated else "") + match_type_abbreviation + value_to_match


class CallerMatch(EnhancementMatch):
    def __init__(self, inner: FrameMatch):
        self.inner = inner

    @property
    def description(self) -> str:
        return f"[ {self.inner.description} ] |"

    def _to_config_structure(self, version: int) -> str:
        return f"[{self.inner._to_config_structure(version)}]|"


class CalleeMatch(EnhancementMatch):
    def __init__(self, inner: FrameMatch):
        self.inner = inner

    @property
    def description(self) -> str:
        return f"| [ {self.inner.description} ]"

    def _to_config_structure(self, version: int) -> str:
        return f"|[{self.inner._to_config_structure(version)}]"
