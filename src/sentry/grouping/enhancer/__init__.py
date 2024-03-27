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
from sentry.features.rollout import in_random_rollout
from sentry.grouping.component import GroupingComponent
from sentry.stacktraces.functions import set_in_app
from sentry.utils import metrics
from sentry.utils.safe import get_path, set_path

from .exceptions import InvalidEnhancerConfig
from .matchers import create_match_frame
from .parser import parse_enhancements
from .rules import Rule

logger = logging.getLogger(__name__)

# NOTE: The 1_000 here is pretty arbitrary. Our builtin base enhancements have about ~300 rules,
# So this leaves quite a bit of headroom for custom enhancement rules as well.
RUST_CACHE = RustCache(1_000)

VERSIONS = [2]
LATEST_VERSION = VERSIONS[-1]


class StacktraceState:
    def __init__(self):
        self.vars = {"max-frames": 0, "min-frames": 0, "invert-stacktrace": False}
        self.setters = {}

    def set(self, var, value, rule=None):
        self.vars[var] = value
        if rule is not None:
            self.setters[var] = rule

    def get(self, var):
        return self.vars.get(var)

    def describe_var_rule(self, var):
        rule = self.setters.get(var)
        if rule is not None:
            return rule.matcher_description

    def add_to_hint(self, hint, var):
        description = self.describe_var_rule(var)
        if description is None:
            return hint
        return f"{hint} by stack trace rule ({description})"


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


RustAssembleResult = tuple[bool | None, str | None, bool, list[RustComponent]]
RustEnhancedFrames = list[tuple[str | None, bool | None]]
RustExceptionData = dict[str, bytes | None]


def make_rust_exception_data(
    exception_data: dict[str, Any],
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


def assemble_rust_components(
    rust_enhancements: RustEnhancements | None,
    match_frames: list[dict[str, bytes]],
    exception_data: dict[str, Any],
    components: list[GroupingComponent],
) -> RustAssembleResult | None:
    """
    If `RustEnhancements` were successfully parsed and usage is enabled,
    this will update all the frame `components` contributions.

    This primarily means updating the `contributes`, `hint` as well as other attributes
    of each frames `GroupingComponent`.
    Instead of modifying the input `components` directly, the results are returned
    as a list of `RustComponent`.
    """
    if not rust_enhancements:
        return None

    try:
        rust_components = [
            RustComponent(
                is_prefix_frame=c.is_prefix_frame or False,
                is_sentinel_frame=c.is_sentinel_frame or False,
                contributes=c.contributes,
            )
            for c in components
        ]

        rust_results = rust_enhancements.assemble_stacktrace_component(
            match_frames, make_rust_exception_data(exception_data), rust_components
        )
        metrics.incr("rust_enhancements.assembling_run")

        return (
            rust_results.contributes,
            rust_results.hint,
            rust_results.invert_stacktrace,
            rust_components,
        )
    except Exception:
        logger.exception("failed running Rust Enhancements component contributions")
        return None


def compare_rust_components(
    component: GroupingComponent,
    invert_stacktrace: bool,
    rust_results: RustAssembleResult | None,
    frames: Sequence[dict[str, Any]],
):
    """
    Compares the results of `rust_results` with the component modifications
    applied by Python code directly to `components`.

    This will log an internal error on every mismatch.
    """
    if not rust_results:
        return

    contributes, hint, invert, rust_components_ = rust_results

    python_components = [
        (c.contributes, c.hint, c.is_prefix_frame, c.is_sentinel_frame) for c in component.values
    ]
    rust_components = [
        (c.contributes, c.hint, c.is_prefix_frame, c.is_sentinel_frame) for c in rust_components_
    ]

    python_res = (component.contributes, component.hint, invert_stacktrace, python_components)
    rust_res = (contributes, hint, invert, rust_components)

    if python_res != rust_res:
        with sentry_sdk.push_scope() as scope:
            scope.set_extra("python_res", python_res)
            scope.set_extra("rust_res", rust_res)
            scope.set_extra("frames", frames)

            sentry_sdk.capture_message("Rust Enhancements mismatch")


def fully_assemble_rust_component(
    rust_results: RustAssembleResult,
    components: list[GroupingComponent],
):
    contributes, hint, invert, rust_components = rust_results

    for py_component, rust_component in zip(components, rust_components):
        py_component.update(
            contributes=rust_component.contributes,
            hint=rust_component.hint,
            is_prefix_frame=rust_component.is_prefix_frame,
            is_sentinel_frame=rust_component.is_sentinel_frame,
        )

    component = GroupingComponent(
        id="stacktrace", values=components, hint=hint, contributes=contributes
    )

    return component, invert


class Enhancements:
    # NOTE: You must add a version to ``VERSIONS`` any time attributes are added
    # to this class, s.t. no enhancements lacking these attributes are loaded
    # from cache.
    # See ``GroupingConfigLoader._get_enhancements`` in src/sentry/grouping/api.py.

    @sentry_sdk.tracing.trace
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

        self._modifier_rules: list[Rule] = []
        self._updater_rules: list[Rule] = []
        for rule in self.iter_rules():
            if modifier_rule := rule._as_modifier_rule():
                self._modifier_rules.append(modifier_rule)
            if updater_rule := rule._as_updater_rule():
                self._updater_rules.append(updater_rule)

    def apply_modifications_to_frame(
        self,
        frames: Sequence[dict[str, Any]],
        platform: str,
        exception_data: dict[str, Any],
    ) -> None:
        """This applies the frame modifications to the frames itself. This does not affect grouping."""

        # Matching frames are used for matching rules
        match_frames = [create_match_frame(frame, platform) for frame in frames]

        rust_enhanced_frames = self.rust_enhancements.apply_modifications_to_frames(
            match_frames, make_rust_exception_data(exception_data)
        )

        for frame, (category, in_app) in zip(frames, rust_enhanced_frames):
            if in_app is not None:
                set_in_app(frame, in_app)
            if category is not None:
                set_path(frame, "data", "category", value=category)

    def update_frame_components_contributions(
        self, components, frames, match_frames, platform, exception_data
    ):
        stacktrace_state = StacktraceState()
        in_memory_cache: dict[str, str] = {}
        # Apply direct frame actions and update the stack state alongside
        for rule in self._updater_rules:
            for idx, action in rule.get_matching_frame_actions(
                match_frames, exception_data, in_memory_cache
            ):
                action.update_frame_components_contributions(components, frames, idx, rule=rule)
                action.modify_stacktrace_state(stacktrace_state, rule)

        # Use the stack state to update frame contributions again to trim
        # down to max-frames.  min-frames is handled on the other hand for
        # the entire stacktrace later.
        max_frames = stacktrace_state.get("max-frames")

        if max_frames > 0:
            ignored = 0
            for component in reversed(components):
                if not component.contributes:
                    continue
                ignored += 1
                if ignored <= max_frames:
                    continue
                hint = "ignored because only %d %s considered" % (
                    max_frames,
                    "frames are" if max_frames != 1 else "frame is",
                )
                hint = stacktrace_state.add_to_hint(hint, var="max-frames")
                component.update(hint=hint, contributes=False)

        return stacktrace_state

    def assemble_stacktrace_component(self, components, frames, platform, exception_data=None):
        """
        This assembles a `stacktrace` grouping component out of the given
        `frame` components and source frames.

        Internally this invokes the `update_frame_components_contributions` method
        but also handles cases where the entire stacktrace should be discarded.
        """
        match_frames = [create_match_frame(frame, platform) for frame in frames]

        rust_results = None
        if in_random_rollout("grouping.rust_enhancers.compare_components"):
            rust_results = assemble_rust_components(
                self.rust_enhancements, match_frames, exception_data, components
            )

        if rust_results is not None and in_random_rollout(
            "grouping.rust_enhancers.prefer_rust_components"
        ):
            return fully_assemble_rust_component(rust_results, components)

        hint = None
        contributes = None
        stacktrace_state = self.update_frame_components_contributions(
            components, frames, match_frames, platform, exception_data
        )

        min_frames = stacktrace_state.get("min-frames")
        if min_frames > 0:
            total_contributes = sum(x.contributes for x in components)
            if 0 < total_contributes < min_frames:
                hint = (
                    "discarded because stack trace only contains %d "
                    "frame%s which is under the configured threshold"
                    % (total_contributes, "s" if total_contributes != 1 else "")
                )
                hint = stacktrace_state.add_to_hint(hint, var="min-frames")
                contributes = False

        invert_stacktrace = stacktrace_state.get("invert-stacktrace")
        component = GroupingComponent(
            id="stacktrace", values=components, hint=hint, contributes=contributes
        )

        compare_rust_components(component, invert_stacktrace, rust_results, frames)

        return component, invert_stacktrace

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

    def iter_rules(self):
        for base in self.bases:
            base = ENHANCEMENT_BASES.get(base)
            if base:
                yield from base.iter_rules()
        yield from self.rules

    def _to_config_structure(self):
        return [
            self.version,
            self.bases,
            [x._to_config_structure(self.version) for x in self.rules],
        ]

    @sentry_sdk.tracing.trace
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
            rules=[Rule._from_config_structure(x, version=version) for x in rules],
            rust_enhancements=rust_enhancements,
            version=version,
            bases=bases,
        )

    @classmethod
    @sentry_sdk.tracing.trace
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
                # NOTE: we want to force parsing the `RustEnhancements` here, as the base rules
                # are required for inheritance, and because they are well tested.
                enhancements = Enhancements.from_config_string(f.read(), id=fn[:-4])
                rv[fn[:-4]] = enhancements
    return rv


ENHANCEMENT_BASES = _load_configs()
del _load_configs
