from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal, TypedDict, int

from sentry.grouping.utils import bool_from_string
from sentry.stacktraces.functions import get_function_name_for_frame
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils import metrics
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path

from .exceptions import InvalidEnhancerConfig

# A cache of function return values, keyed by function and args
ReturnValueCache = dict[tuple[Any, ...], Any]


def _cached(
    cache: ReturnValueCache,
    function: Callable[..., Any],
    *args: Any,
    **kwargs: Any,
) -> Any:
    """Calls ``function`` or retrieves its return value from the ``cache``.

    This is similar to ``functools.cache``, but uses a custom cache instead
    of a global one. The cache can be shared between multiple functions.
    """
    key = (function, args, tuple(sorted(kwargs.items())))

    if key in cache:
        rv = cache[key]
    else:
        rv = cache[key] = function(*args)

    return rv


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


# TODO: Maybe someday mypy won't make us keep this as a separate list
MatchFrameKey = Literal[
    "category", "family", "function", "in_app", "orig_in_app", "module", "package", "path"
]


def _get_function_name(frame_data: dict[str, Any], platform: str | None) -> str:
    function_name = get_function_name_for_frame(frame_data, platform)

    return function_name or "<unknown>"


def create_match_frame(frame_data: dict[str, Any], platform: str | None) -> MatchFrame:
    """Create flat dict of values relevant to matchers"""
    match_frame = dict(
        category=get_path(frame_data, "data", "category"),
        family=get_behavior_family_for_platform(frame_data.get("platform") or platform),
        function=_get_function_name(frame_data, platform),
        in_app=frame_data.get("in_app"),
        orig_in_app=get_path(frame_data, "data", "orig_in_app"),
        module=get_path(frame_data, "module"),
        package=frame_data.get("package"),
        path=frame_data.get("abs_path") or frame_data.get("filename"),
    )

    for key in list(match_frame.keys()):
        value = match_frame[key]
        if isinstance(value, (bytes, str)):
            if isinstance(value, str):
                value = match_frame[key] = value.encode("utf-8")

            if key in ("package", "path"):
                # NOTE: path-like matchers are case insensitive, and normalize
                # file-system separators to `/`.
                # We do this here in a central place instead of in each matcher separately.
                value = match_frame[key] = value.lower().replace(b"\\", b"/")

    return MatchFrame(
        category=match_frame["category"],
        family=match_frame["family"],
        function=match_frame["function"],
        in_app=match_frame["in_app"],
        orig_in_app=match_frame["orig_in_app"],
        module=match_frame["module"],
        package=match_frame["package"],
        path=match_frame["path"],
    )


class EnhancementMatch:
    key: str
    pattern: str

    def matches_frame(
        self,
        frames: list[MatchFrame],
        idx: int,
        exception_data: dict[str, Any],
        cache: ReturnValueCache,
    ) -> bool:
        raise NotImplementedError()

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
    instances: dict[InstanceKey, EnhancementMatch] = {}
    field: MatchFrameKey | None = None

    @classmethod
    def from_key(cls, key: str, pattern: str, negated: bool) -> EnhancementMatch:
        instance_key = (key, pattern, negated)
        if instance_key in cls.instances:
            instance = cls.instances[instance_key]
        else:
            instance = cls.instances[instance_key] = cls._from_key(key, pattern, negated)
            metrics.gauge("grouping.enhancer.matchers.registry_size", len(cls.instances))

        return instance

    @classmethod
    def _from_key(cls, key: str, pattern: str, negated: bool) -> EnhancementMatch:
        subclass = {
            "package": PackageMatch,
            "path": PathMatch,
            "family": FamilyMatch,
            "app": InAppMatch,
            "function": FunctionMatch,
            "module": ModuleMatch,
            "category": CategoryMatch,
            "type": ExceptionTypeMatch,
            "value": ExceptionValueMatch,
            "mechanism": ExceptionMechanismMatch,
        }[MATCHERS[key]]

        return subclass(key, pattern, negated)

    def __init__(self, key: str, pattern: str, negated: bool = False):
        super().__init__()
        try:
            self.key = MATCHERS[key]
        except KeyError:
            raise InvalidEnhancerConfig("Unknown matcher '%s'" % key)
        self.pattern = pattern
        self._encoded_pattern = pattern.encode("utf-8")
        self.negated = negated

    @property
    def description(self) -> str:
        pattern_contains_whitespace = self.pattern.split() != [self.pattern]
        return "{}{}:{}".format(
            "!" if self.negated else "",
            self.key,
            self.pattern if not pattern_contains_whitespace else f'"{self.pattern}"',
        )

    def matches_frame(
        self,
        frames: list[MatchFrame],
        idx: int,
        exception_data: dict[str, Any],
        cache: ReturnValueCache,
    ) -> bool:
        match_frame = frames[idx]
        rv = self._positive_frame_match(match_frame, exception_data, cache)
        if self.negated:
            rv = not rv
        return rv

    def _positive_frame_match(
        self, match_frame: MatchFrame, exception_data: dict[str, Any], cache: ReturnValueCache
    ) -> bool:
        # Implement in subclasses
        raise NotImplementedError

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


def path_like_match(pattern: bytes, value: bytes) -> bool:
    """Stand-alone function for use with ``_cached``"""
    if glob_match(value, pattern, ignorecase=False, doublestar=True, path_normalize=True):
        return True
    if not value.startswith(b"/") and glob_match(
        b"/" + value, pattern, ignorecase=False, doublestar=True, path_normalize=True
    ):
        return True

    return False


class PathLikeMatch(FrameMatch):
    def __init__(self, key: str, pattern: str, negated: bool = False):
        # NOTE: We do not want to mess with `pattern` directly, as that is used for the `description`.
        # We rather want to `lower()` only the encoded pattern used within glob matching.
        super().__init__(key, pattern, negated)
        self._encoded_pattern = pattern.lower().encode("utf-8")

    def _positive_frame_match(
        self, match_frame: MatchFrame, exception_data: dict[str, Any], cache: ReturnValueCache
    ) -> bool:
        if not self.field:  # Shouldn't happen, but it keeps mypy happy
            return False

        value = match_frame[self.field]
        if value is None:
            return False

        return _cached(cache, path_like_match, self._encoded_pattern, value)


class PackageMatch(PathLikeMatch):
    field = "package"


class PathMatch(PathLikeMatch):
    field = "path"


class FamilyMatch(FrameMatch):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._flags = set(self._encoded_pattern.split(b","))

    def _positive_frame_match(
        self, match_frame: MatchFrame, exception_data: dict[str, Any], cache: ReturnValueCache
    ) -> bool:
        if b"all" in self._flags:
            return True

        return match_frame["family"] in self._flags


class InAppMatch(FrameMatch):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._ref_val = bool_from_string(self.pattern)

    def _positive_frame_match(
        self, match_frame: MatchFrame, exception_data: dict[str, Any], cache: ReturnValueCache
    ) -> bool:
        ref_val = self._ref_val
        return ref_val is not None and ref_val == bool(match_frame["in_app"])


class FrameFieldMatch(FrameMatch):
    def _positive_frame_match(
        self, match_frame: MatchFrame, exception_data: dict[str, Any], cache: ReturnValueCache
    ) -> bool:
        if not self.field:  # Shouldn't happen, but it keeps mypy happy
            return False

        value = match_frame[self.field]
        if value is None:
            return False
        if value == self._encoded_pattern:
            return True

        return _cached(cache, glob_match, value, self._encoded_pattern)


class FunctionMatch(FrameFieldMatch):
    field = "function"


class ModuleMatch(FrameFieldMatch):
    field = "module"


class CategoryMatch(FrameFieldMatch):
    field = "category"


class ExceptionFieldMatch(FrameMatch):
    field_path: list[str]

    def matches_frame(
        self,
        frames: list[MatchFrame],
        idx: int | None,
        exception_data: dict[str, Any],
        cache: ReturnValueCache,
    ) -> bool:
        match_frame = None
        rv = self._positive_frame_match(match_frame, exception_data, cache)
        if self.negated:
            rv = not rv
        return rv

    def _positive_frame_match(
        self,
        match_frame: MatchFrame | None,
        exception_data: dict[str, Any],
        cache: ReturnValueCache,
    ) -> bool:
        field = get_path(exception_data, *self.field_path) or "<unknown>"
        return _cached(cache, glob_match, field, self._encoded_pattern)


class ExceptionTypeMatch(ExceptionFieldMatch):
    field_path = ["type"]


class ExceptionValueMatch(ExceptionFieldMatch):
    field_path = ["value"]


class ExceptionMechanismMatch(ExceptionFieldMatch):
    field_path = ["mechanism", "type"]


class CallerMatch(EnhancementMatch):
    def __init__(self, inner: FrameMatch):
        self.inner = inner

    @property
    def description(self) -> str:
        return f"[ {self.inner.description} ] |"

    def _to_config_structure(self, version: int) -> str:
        return f"[{self.inner._to_config_structure(version)}]|"

    def matches_frame(
        self,
        frames: list[MatchFrame],
        idx: int,
        exception_data: dict[str, Any],
        cache: ReturnValueCache,
    ) -> bool:
        return idx > 0 and self.inner.matches_frame(frames, idx - 1, exception_data, cache)


class CalleeMatch(EnhancementMatch):
    def __init__(self, inner: FrameMatch):
        self.inner = inner

    @property
    def description(self) -> str:
        return f"| [ {self.inner.description} ]"

    def _to_config_structure(self, version: int) -> str:
        return f"|[{self.inner._to_config_structure(version)}]"

    def matches_frame(
        self,
        frames: list[MatchFrame],
        idx: int,
        exception_data: dict[str, Any],
        cache: ReturnValueCache,
    ) -> bool:
        return idx < len(frames) - 1 and self.inner.matches_frame(
            frames, idx + 1, exception_data, cache
        )
