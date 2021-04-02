from typing import Optional

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


class Match:
    description = None

    def matches_frame(self, frames, idx, platform, exception_data):
        raise NotImplementedError()

    def _to_config_structure(self, version):
        raise NotImplementedError()

    @staticmethod
    def _from_config_structure(obj, version):
        val = obj
        if isinstance(val, list):
            return RangeMatch(
                Match._from_config_structure(val[0], version),
                Match._from_config_structure(val[1], version),
                val[2],
                val[3],
            )

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

    def matches_frame(self, frames, idx, platform, exception_data):
        frame_data = frames[idx]
        rv = self._positive_frame_match(frame_data, platform, exception_data)
        if self.negated:
            rv = not rv
        return rv

    def _positive_frame_match(self, frame_data, platform, exception_data):
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


class PathLikeMatch(FrameMatch):
    def _positive_frame_match(self, frame_data, platform, exception_data):
        return self._match(self._value(frame_data))

    def _match(self, value):
        if glob_match(value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True):
            return True
        if not value.startswith("/") and glob_match(
            "/" + value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True
        ):
            return True

        return False


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
        self._flags = self.pattern.split(",")

    def _positive_frame_match(self, frame_data, platform, exception_data):
        if "all" in self._flags:
            return True
        family = get_behavior_family_for_platform(frame_data.get("platform") or platform)
        return family in self._flags


class InAppMatch(FrameMatch):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._ref_val = get_rule_bool(self.pattern)

    def _positive_frame_match(self, frame_data, platform, exception_data):
        ref_val = self._ref_val
        return ref_val is not None and ref_val == frame_data.get("in_app")


class FunctionMatch(FrameMatch):
    def _positive_frame_match(self, frame_data, platform, exception_data):
        value = get_function_name_for_frame(frame_data, platform) or "<unknown>"
        return glob_match(value, self.pattern)


class FrameFieldMatch(FrameMatch):
    def _positive_frame_match(self, frame_data, platform, exception_data):
        field = get_path(frame_data, *self.field_path)
        return glob_match(field, self.pattern)


class ModuleMatch(FrameFieldMatch):

    field_path = ["module"]


class CategoryMatch(FrameFieldMatch):

    field_path = ["data", "category"]


class ExceptionFieldMatch(FrameMatch):
    def _positive_frame_match(self, frame_data, platform, exception_data):
        field = get_path(exception_data, *self.field_path) or "<unknown>"
        return glob_match(field, self.pattern)


class ExceptionTypeMatch(ExceptionFieldMatch):

    field_path = ["type"]


class ExceptionValueMatch(ExceptionFieldMatch):

    field_path = ["value"]


class ExceptionMechanismMatch(ExceptionFieldMatch):

    field_path = ["mechanism", "type"]


class RangeMatch(Match):
    def __init__(
        self,
        start: Optional[FrameMatch],
        end: Optional[FrameMatch],
        start_neighbouring: bool,
        end_neighbouring: bool,
    ):
        super().__init__()
        self.start = start
        self.end = end
        self.start_neighbouring = start_neighbouring
        self.end_neighbouring = end_neighbouring

    @property
    def description(self):
        sn = "| " if self.start_neighbouring else ""
        en = " |" if self.end_neighbouring else ""
        start = f" {self.start.description}" if self.start else ""
        end = f"{self.end.description} " if self.end else ""
        return f"[{start} {sn}..{en} {end}]"

    def _to_config_structure(self, version):
        return [
            self.start._to_config_structure(version),
            self.end._to_config_structure(version),
            self.start_neighbouring,
            self.end_neighbouring,
        ]

    def matches_frame(self, frames, idx, platform, exception_data):
        if self.end is not None:
            start_idx = 0 if not self.end_neighbouring else max(0, idx - 1)

            for idx2 in reversed(range(start_idx, idx)):
                if self.end.matches_frame(frames, idx2, platform, exception_data):
                    break
            else:
                return False

        if self.start is not None:
            end_idx = len(frames) if not self.start_neighbouring else min(len(frames), idx + 2)
            for idx2 in range(idx + 1, end_idx):
                if self.start.matches_frame(frames, idx2, platform, exception_data):
                    break
            else:
                return False

        return True
