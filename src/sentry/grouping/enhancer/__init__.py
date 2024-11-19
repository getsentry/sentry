from __future__ import annotations

import base64
import logging
import os
import zlib
from collections.abc import Sequence
from typing import Any, Literal

import msgpack
import sentry_sdk
import zstandard
from sentry_ophio.enhancers import Cache as RustCache
from sentry_ophio.enhancers import Component as RustComponent
from sentry_ophio.enhancers import Enhancements as RustEnhancements

from sentry import projectoptions
from sentry.grouping.component import FrameGroupingComponent, StacktraceGroupingComponent
from sentry.stacktraces.functions import set_in_app
from sentry.utils.safe import get_path, set_path

from .exceptions import InvalidEnhancerConfig
from .matchers import create_match_frame
from .parser import parse_enhancements
from .rules import EnhancementRule

logger = logging.getLogger(__name__)

# NOTE: The 1_000 here is pretty arbitrary. Our builtin base enhancements have about ~300 rules,
# So this leaves quite a bit of headroom for custom enhancement rules as well.
RUST_CACHE = RustCache(1_000)

VERSIONS = [2]
LATEST_VERSION = VERSIONS[-1]

VALID_PROFILING_MATCHER_PREFIXES = (
    "stack.abs_path",
    "stack.module",
    "stack.function",
    "stack.package",
)
VALID_PROFILING_ACTIONS_SET = frozenset(["+app", "-app"])


def merge_rust_enhancements(
    bases: list[str], rust_enhancements: RustEnhancements
) -> RustEnhancements:
    """
    This will merge the parsed enhancements together with the `bases`.
    It pretty much concatenates all the rules in `bases` (in order) together
    with all the rules in the incoming `rust_enhancements`.
    """
    merged_rust_enhancements = RustEnhancements.empty()
    for base_id in bases:
        base = ENHANCEMENT_BASES.get(base_id)
        if base:
            merged_rust_enhancements.extend_from(base.rust_enhancements)
    merged_rust_enhancements.extend_from(rust_enhancements)
    return merged_rust_enhancements


def parse_rust_enhancements(
    source: Literal["config_structure", "config_string"], input: str | bytes
) -> RustEnhancements:
    """
    Parses ``RustEnhancements`` from either a msgpack-encoded `config_structure`,
    or from the text representation called `config_string`.
    """
    try:
        if source == "config_structure":
            assert isinstance(input, bytes)
            return RustEnhancements.from_config_structure(input, RUST_CACHE)
        else:
            assert isinstance(input, str)
            return RustEnhancements.parse(input, RUST_CACHE)
    except RuntimeError as e:  # Rust bindings raise parse errors as `RuntimeError`
        raise InvalidEnhancerConfig(str(e))


RustExceptionData = dict[str, bytes | None]


def make_rust_exception_data(
    exception_data: dict[str, Any] | None,
) -> RustExceptionData:
    e = exception_data or {}
    e = {
        "ty": e.get("type"),
        "value": e.get("value"),
        "mechanism": get_path(e, "mechanism", "type"),
    }
    for key in e.keys():
        value = e[key]
        if isinstance(value, str):
            e[key] = value.encode("utf-8")
    return e


def is_valid_profiling_matcher(matchers: list[str]) -> bool:
    for matcher in matchers:
        if not matcher.startswith(VALID_PROFILING_MATCHER_PREFIXES):
            return False
    return True


def is_valid_profiling_action(action: str) -> bool:
    return action in VALID_PROFILING_ACTIONS_SET


def keep_profiling_rules(config: str) -> str:
    filtered_rules = []
    if config is None or config == "":
        return ""
    for rule in config.splitlines():
        rule = rule.strip()
        if rule == "" or rule.startswith("#"):  # ignore comment lines
            continue
        *matchers, action = rule.split()
        if is_valid_profiling_matcher(matchers) and is_valid_profiling_action(action):
            filtered_rules.append(rule)
    return "\n".join(filtered_rules)


class Enhancements:
    # NOTE: You must add a version to ``VERSIONS`` any time attributes are added
    # to this class, s.t. no enhancements lacking these attributes are loaded
    # from cache.
    # See ``GroupingConfigLoader._get_enhancements`` in src/sentry/grouping/api.py.

    def __init__(
        self, rules, rust_enhancements: RustEnhancements, version=None, bases=None, id=None
    ):
        self.id = id
        self.rules = rules
        if version is None:
            version = LATEST_VERSION
        self.version = version
        if bases is None:
            bases = []
        self.bases = bases

        self.rust_enhancements = merge_rust_enhancements(bases, rust_enhancements)

    def apply_modifications_to_frame(
        self,
        frames: Sequence[dict[str, Any]],
        platform: str,
        exception_data: dict[str, Any],
    ) -> None:
        """
        This applies the frame modifications to the frames itself. This does not affect grouping.
        """
        match_frames = [create_match_frame(frame, platform) for frame in frames]

        rust_enhanced_frames = self.rust_enhancements.apply_modifications_to_frames(
            match_frames, make_rust_exception_data(exception_data)
        )

        for frame, (category, in_app) in zip(frames, rust_enhanced_frames):
            if in_app is not None:
                set_in_app(frame, in_app)
            if category is not None:
                set_path(frame, "data", "category", value=category)

    def assemble_stacktrace_component(
        self,
        components: list[FrameGroupingComponent],
        frames: list[dict[str, Any]],
        platform: str | None,
        exception_data: dict[str, Any] | None = None,
    ) -> tuple[StacktraceGroupingComponent, bool]:
        """
        This assembles a `stacktrace` grouping component out of the given
        `frame` components and source frames.

        This also handles cases where the entire stacktrace should be discarded.
        """
        match_frames = [create_match_frame(frame, platform) for frame in frames]

        rust_components = [RustComponent(contributes=c.contributes) for c in components]

        rust_results = self.rust_enhancements.assemble_stacktrace_component(
            match_frames, make_rust_exception_data(exception_data), rust_components
        )

        for py_component, rust_component in zip(components, rust_components):
            py_component.update(contributes=rust_component.contributes, hint=rust_component.hint)

        component = StacktraceGroupingComponent(
            values=components,
            hint=rust_results.hint,
            contributes=rust_results.contributes,
        )

        return component, rust_results.invert_stacktrace

    def as_dict(self, with_rules=False):
        rv = {
            "id": self.id,
            "bases": self.bases,
            "latest": projectoptions.lookup_well_known_key(
                "sentry:grouping_enhancements_base"
            ).get_default(epoch=projectoptions.LATEST_EPOCH)
            == self.id,
        }
        if with_rules:
            rv["rules"] = [x.as_dict() for x in self.rules]
        return rv

    def _to_config_structure(self):
        return [
            self.version,
            self.bases,
            [x._to_config_structure(self.version) for x in self.rules],
        ]

    def dumps(self) -> str:
        encoded = msgpack.dumps(self._to_config_structure())
        compressed = zstandard.compress(encoded)
        return base64.urlsafe_b64encode(compressed).decode("ascii").strip("=")

    @classmethod
    def _from_config_structure(cls, data, rust_enhancements: RustEnhancements) -> Enhancements:
        version, bases, rules = data
        if version not in VERSIONS:
            raise ValueError("Unknown version")
        return cls(
            rules=[EnhancementRule._from_config_structure(x, version=version) for x in rules],
            rust_enhancements=rust_enhancements,
            version=version,
            bases=bases,
        )

    @classmethod
    def loads(cls, data) -> Enhancements:
        if isinstance(data, str):
            data = data.encode("ascii", "ignore")
        padded = data + b"=" * (4 - (len(data) % 4))
        try:
            compressed = base64.urlsafe_b64decode(padded)

            if compressed.startswith(b"\x28\xb5\x2f\xfd"):
                encoded = zstandard.decompress(compressed)
            else:
                encoded = zlib.decompress(compressed)

            rust_enhancements = parse_rust_enhancements("config_structure", encoded)

            return cls._from_config_structure(msgpack.loads(encoded, raw=False), rust_enhancements)
        except (LookupError, AttributeError, TypeError, ValueError) as e:
            raise ValueError("invalid stack trace rule config: %s" % e)

    @classmethod
    @sentry_sdk.tracing.trace
    def from_config_string(self, s, bases=None, id=None) -> Enhancements:
        rust_enhancements = parse_rust_enhancements("config_string", s)

        rules = parse_enhancements(s)

        return Enhancements(
            rules,
            rust_enhancements=rust_enhancements,
            bases=bases,
            id=id,
        )


def _load_configs() -> dict[str, Enhancements]:
    rv = {}
    base = os.path.join(os.path.abspath(os.path.dirname(__file__)), "enhancement-configs")
    for fn in os.listdir(base):
        if fn.endswith(".txt"):
            with open(os.path.join(base, fn), encoding="utf-8") as f:
                # We cannot use `:` in filenames on Windows but we already have ids with
                # `:` in their names hence this trickery.
                fn = fn.replace("@", ":")
                enhancements = Enhancements.from_config_string(f.read(), id=fn[:-4])
                rv[fn[:-4]] = enhancements
    return rv


ENHANCEMENT_BASES = _load_configs()
del _load_configs
