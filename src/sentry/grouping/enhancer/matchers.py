from sentry.grouping.utils import get_rule_bool
from sentry.stacktraces.functions import get_function_name_for_frame_parts
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils.functional import cached
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


class Match:
    description = None
    keys = tuple()

    def matches_frame(self, frames, idx, platform, exception_data, cache):
        raise NotImplementedError()

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

        instance_key = (key, pattern, negated)
        if instance_key in cls.instances:
            instance = cls.instances[instance_key]
        else:
            instance = cls.instances[instance_key] = cls._from_key(key, pattern, negated)

        return instance

    @classmethod
    def _from_key(cls, key, pattern, negated):

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
            self.keys = (self.key,)
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

    def matches_frame(self, frames, idx, platform, exception_data, cache):
        frame_data = frames[idx]
        rv = self._positive_frame_match(frame_data, platform, exception_data, cache)
        if self.negated:
            rv = not rv
        return rv

    def _positive_frame_match(self, frame_data, platform, exception_data, cache):
        # Implement is subclasses
        raise NotImplementedError

    def _to_config_structure(self, version):
        if self.key == "family":
            arg = "".join([_f for _f in [FAMILIES.get(x) for x in self.pattern.split(",")] if _f])
        elif self.key == "app":
            arg = {True: "1", False: "0"}.get(get_rule_bool(self.pattern), "")
        else:
            arg = self.pattern
        return ("!" if self.negated else "") + MATCH_KEYS[self.key] + arg


def path_like_match(pattern, value):

    if glob_match(value, pattern, ignorecase=True, doublestar=True, path_normalize=True):
        return True
    if not value.startswith("/") and glob_match(
        "/" + value, pattern, ignorecase=True, doublestar=True, path_normalize=True
    ):
        return True

    return False


class PathLikeMatch(FrameMatch):
    def _positive_frame_match(self, frame_data, platform, exception_data, cache):

        return cached(cache, path_like_match, self.pattern, self._value(frame_data))


class PackageMatch(PathLikeMatch):
    @staticmethod
    def _value(frame_data):
        return frame_data.get("package") or ""


class PathMatch(PathLikeMatch):
    @staticmethod
    def _value(frame_data):
        return frame_data.get("abs_path") or frame_data.get("filename") or ""


class FamilyMatch(FrameMatch):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._flags = set(self.pattern.split(","))

    def _positive_frame_match(self, frame_data, platform, exception_data, cache):
        if "all" in self._flags:
            return True
        family = get_behavior_family_for_platform(frame_data.get("platform") or platform)
        return family in self._flags


class InAppMatch(FrameMatch):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._ref_val = get_rule_bool(self.pattern)

    def _positive_frame_match(self, frame_data, platform, exception_data, cache):
        ref_val = self._ref_val
        return ref_val is not None and ref_val == frame_data.get("in_app")


class FunctionMatch(FrameMatch):
    def _positive_frame_match(self, frame_data, platform, exception_data, cache):
        if hasattr(frame_data, "get_raw_data"):
            frame_data = frame_data.get_raw_data()

        function_name = cached(
            cache,
            get_function_name_for_frame_parts,
            frame_data.get("raw_function"),
            frame_data.get("function"),
            frame_data.get("platform"),
            platform,
        )

        value = function_name or "<unknown>"
        return cached(cache, glob_match, value, self.pattern)


class FrameFieldMatch(FrameMatch):
    def _positive_frame_match(self, frame_data, platform, exception_data, cache):
        field = get_path(frame_data, *self.field_path)
        return cached(cache, glob_match, field, self.pattern)


class ModuleMatch(FrameFieldMatch):

    field_path = ["module"]


class CategoryMatch(FrameFieldMatch):

    field_path = ["data", "category"]


class ExceptionFieldMatch(FrameMatch):
    def _positive_frame_match(self, frame_data, platform, exception_data, cache):
        field = get_path(exception_data, *self.field_path) or "<unknown>"
        return cached(cache, glob_match, field, self.pattern)


class ExceptionTypeMatch(ExceptionFieldMatch):

    field_path = ["type"]


class ExceptionValueMatch(ExceptionFieldMatch):

    field_path = ["value"]


class ExceptionMechanismMatch(ExceptionFieldMatch):

    field_path = ["mechanism", "type"]


class CallerMatch(Match):
    def __init__(self, caller: FrameMatch):
        self.caller = caller

    @property
    def description(self):
        return f"[ {self.caller.description} ] |"

    def _to_config_structure(self, version):
        return f"[{self.caller._to_config_structure(version)}]|"

    def matches_frame(self, frames, idx, platform, exception_data, cache):
        return idx > 0 and self.caller.matches_frame(
            frames, idx - 1, platform, exception_data, cache
        )


class CalleeMatch(Match):
    def __init__(self, caller: FrameMatch):
        self.caller = caller

    @property
    def description(self):
        return f"| [ {self.caller.description} ]"

    def _to_config_structure(self, version):
        return f"|[{self.caller._to_config_structure(version)}]"

    def matches_frame(self, frames, idx, platform, exception_data, cache):
        return idx < len(frames) - 1 and self.caller.matches_frame(
            frames, idx + 1, platform, exception_data, cache
        )
