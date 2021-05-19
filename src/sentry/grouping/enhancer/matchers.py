import dataclasses
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Mapping, Optional, Sequence, Tuple

from sentry.grouping.utils import get_rule_bool
from sentry.stacktraces.functions import get_function_name_for_frame
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path

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

FAMILIES = {"native": "N", "javascript": "J", "all": "a"}
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
    "category": "category",
    # fingerprinting specific fields
    "family": "family",
    "app": "app",
}


def _get_function_name(frame_data: dict, platform: Optional[str]):

    function_name = get_function_name_for_frame(frame_data, platform)

    return function_name or "<unknown>"


def create_match_frame(frame_data: dict, platform: Optional[str]) -> dict:
    """ Create flat dict of values relevant to matchers """
    return frame_data


@dataclass
class MatchConfig:
    field: str
    path_like: bool
    pattern_is_glob: bool
    negated: bool
    patterns: Sequence[str]
    required: bool = False


class Match(ABC):
    description = None

    @abstractmethod
    def extract_frame_data(self, frames, idx, platform, exception_data):
        raise NotImplementedError()

    def matches_frame(self, frames, idx, platform, exception_data, cache):
        config = self.get_match_config()
        global_extracted, frame_extracted = self.extract_frame_data(
            frames, idx, platform, exception_data
        )
        if config.field in frame_extracted:
            val = frame_extracted[config.field]
        elif config.field in global_extracted:
            val = global_extracted[config.field]
        elif config.required:
            return False
        else:
            val = None

        if val is None:
            is_match = False
        elif config.pattern_is_glob:
            if config.path_like:
                is_match = any(path_like_match(val, pat.encode("utf8")) for pat in config.patterns)
            else:
                is_match = any(glob_match(val, pat.encode("utf8")) for pat in config.patterns)
        else:
            is_match = val in config.patterns

        if config.negated:
            is_match = not is_match

        return is_match

    @abstractmethod
    def get_match_config(self) -> MatchConfig:
        raise NotImplementedError()

    @abstractmethod
    def _to_config_structure(self, version):
        raise NotImplementedError()

    @staticmethod
    def _from_config_structure(obj, version):
        val = obj
        if val.startswith("|[") and val.endswith("]"):
            return CalleeMatch(Match._from_config_structure(val[2:-1]))
        if val.startswith("[") and val.endswith("]|"):
            return CallerMatch(Match._from_config_structure(val[1:-2]))

        if val.startswith("!"):
            negated = True
            val = val[1:]
        else:
            negated = False
        key = SHORT_MATCH_KEYS[val[0]]
        if key == "family":
            arg = ",".join([_f for _f in [REVERSE_FAMILIES.get(x) for x in val[1:]] if _f])
        else:
            arg = val[1:]

        return FrameMatch.from_key(key, arg, negated)


class FrameMatch(Match):

    # Global registry of matchers
    instances = {}

    @classmethod
    def from_key(cls, key, pattern, negated):

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

    def __init__(self, key, pattern, negated=False):
        super().__init__()
        try:
            self.key = MATCHERS[key]
        except KeyError:
            raise InvalidEnhancerConfig("Unknown matcher '%s'" % key)
        self.pattern = pattern
        self.negated = negated

    @property
    def description(self):
        return "{}:{}".format(
            self.key,
            self.pattern.split() != [self.pattern] and '"%s"' % self.pattern or self.pattern,
        )

    def _to_config_structure(self, version):
        if self.key == "family":
            arg = "".join([_f for _f in [FAMILIES.get(x) for x in self.pattern.split(",")] if _f])
        elif self.key == "app":
            arg = {True: "1", False: "0"}.get(get_rule_bool(self.pattern), "")
        else:
            arg = self.pattern
        return ("!" if self.negated else "") + MATCH_KEYS[self.key] + arg


def path_like_match(value, pattern):
    """ Stand-alone function for use with ``cached`` """
    if isinstance(value, str):
        value = value.encode("utf8")
    if isinstance(pattern, str):
        pattern = pattern.encode("utf8")

    if value is not None:
        value = value.lower()

    pattern = pattern.lower()

    if glob_match(value, pattern, ignorecase=False, doublestar=True, path_normalize=True):
        return True
    if not value.startswith(b"/") and glob_match(
        b"/" + value, pattern, ignorecase=False, doublestar=True, path_normalize=True
    ):
        return True

    return False


class FamilyMatch(FrameMatch):
    def extract_frame_data(
        self, frames, idx, platform, exception_data
    ) -> Tuple[Mapping[str, Any], Mapping[str, Any]]:
        frame_platform = frames[idx].get("platform")
        if frame_platform:
            return {}, {"family": get_behavior_family_for_platform(frame_platform)}
        else:
            return {"family": get_behavior_family_for_platform(platform)}, {}

    def get_match_config(self) -> MatchConfig:
        flags = self.pattern.split(",")
        if "all" in flags:
            return MatchConfig(
                field="family",
                pattern_is_glob=False,
                patterns=[],
                path_like=False,
                negated=not self.negated,
            )
        else:
            return MatchConfig(
                field="family",
                pattern_is_glob=False,
                path_like=False,
                patterns=flags,
                negated=self.negated,
            )


class InAppMatch(FrameMatch):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._ref_val = get_rule_bool(self.pattern)

    def extract_frame_data(self, frames, idx, platform, exception_data):
        return {}, {"in_app": frames[idx].get("in_app")}

    def get_match_config(self) -> MatchConfig:
        return MatchConfig(
            field="in_app",
            pattern_is_glob=False,
            path_like=False,
            patterns=[self._ref_val],
            negated=self.negated,
        )


class FrameFieldMatch(FrameMatch):
    path_like: bool = False
    field_name: str
    field_path: Sequence[str]

    def extract_frame_data(self, frames, idx, platform, exception_data):
        value = get_path(frames[idx], *self.field_path)
        return {}, {self.field_name: value}

    def get_match_config(self) -> MatchConfig:
        pattern = self.pattern
        return MatchConfig(
            field=self.field_name,
            pattern_is_glob=True,
            path_like=self.path_like,
            patterns=[pattern],
            negated=self.negated,
        )


class PackageMatch(FrameFieldMatch):
    path_like = True
    field_name = "package"
    field_path = ["package"]


class PathMatch(FrameFieldMatch):
    path_like = True
    field_name = "path"
    field_path = ["path"]  # unused

    def extract_frame_data(self, frames, idx, platform, exception_data):
        value = get_path(frames[idx], "abs_path") or get_path(frames[idx], "filename")
        return {}, {"path": value}


class FunctionMatch(FrameFieldMatch):
    field_name = "function"
    field_path = ["function"]

    def extract_frame_data(self, frames, idx, platform, exception_data):
        return {}, {"function": _get_function_name(frames[idx], platform)}


class ModuleMatch(FrameFieldMatch):
    field_name = "module"

    field_path = ["module"]


class CategoryMatch(FrameFieldMatch):
    field_name = "category"
    field_path = ["data", "category"]


class ExceptionFieldMatch(FrameMatch):
    field_path: Sequence[str]
    field_name: str

    def extract_frame_data(self, frames, idx, platform, exception_data):
        return {self.field_name: get_path(exception_data, *self.field_path) or "<unknown>"}, {}

    def get_match_config(self) -> MatchConfig:
        return MatchConfig(
            field=self.field_name,
            pattern_is_glob=True,
            path_like=False,
            patterns=[self.pattern],
            negated=self.negated,
        )


class ExceptionTypeMatch(ExceptionFieldMatch):
    field_name = "exception_type"

    field_path = ["type"]


class ExceptionValueMatch(ExceptionFieldMatch):
    field_name = "exception_value"

    field_path = ["value"]


class ExceptionMechanismMatch(ExceptionFieldMatch):
    field_name = "exception_mechanism"

    field_path = ["mechanism", "type"]


@dataclass
class CallerMatch(Match):
    caller: FrameMatch

    @property
    def description(self):
        return f"[ {self.caller.description} ] |"

    def _to_config_structure(self, version):
        return f"[{self.caller._to_config_structure(version)}]|"

    def extract_frame_data(self, frames, idx, platform, exception_data):
        if idx <= 0:
            return {}, {}

        _exception_data, frame_data = self.caller.extract_frame_data(
            frames, idx - 1, platform, exception_data
        )
        return {}, {f"caller_{k}": v for k, v in frame_data.items()}

    def get_match_config(self) -> MatchConfig:
        rv = self.caller.get_match_config()
        return dataclasses.replace(rv, field=f"caller_{rv.field}", required=True)


@dataclass
class CalleeMatch(Match):
    callee: FrameMatch

    @property
    def description(self):
        return f"| [ {self.callee.description} ]"

    def _to_config_structure(self, version):
        return f"|[{self.callee._to_config_structure(version)}]"

    def extract_frame_data(self, frames, idx, platform, exception_data):
        if idx >= len(frames) - 1:
            return {}, {}

        _exception_data, frame_data = self.callee.extract_frame_data(
            frames, idx + 1, platform, exception_data
        )
        return {}, {f"callee_{k}": v for k, v in frame_data.items()}

    def get_match_config(self) -> MatchConfig:
        rv = self.callee.get_match_config()
        return dataclasses.replace(rv, field=f"callee_{rv.field}", required=True)
