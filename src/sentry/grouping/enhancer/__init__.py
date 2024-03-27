from __future__ import annotations

import base64
import logging
import os
import zlib
from collections.abc import Sequence
from hashlib import md5
from typing import Any, Literal

import msgpack
import sentry_sdk
import zstandard
from django.core.cache import cache
from sentry_ophio.enhancers import Cache as RustCache
from sentry_ophio.enhancers import Component as RustComponent
from sentry_ophio.enhancers import Enhancements as RustEnhancements

from sentry import projectoptions
from sentry.features.rollout import in_random_rollout
from sentry.grouping.component import GroupingComponent
from sentry.stacktraces.functions import set_in_app
from sentry.utils import metrics
from sentry.utils.hashlib import hash_value
from sentry.utils.safe import get_path, set_path

from .exceptions import InvalidEnhancerConfig
from .matchers import create_match_frame
from .parser import parse_enhancements
from .rules import Rule

DATADOG_KEY = "save_event.stacktrace"
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


def apply_rust_enhancements(
    rust_enhancements: RustEnhancements | None,
    match_frames: list[dict[str, bytes]],
    exception_data: dict[str, Any],
) -> RustEnhancedFrames | None:
    """
    If `RustEnhancements` were successfully parsed and usage is enabled,
    this will apply all the modifications from enhancement rules to `match_frames`,
    returning a tuple of `(modified category, modified in_app)` for each frame.
    """
    if not rust_enhancements:
        return None

    try:
        rust_enhanced_frames = rust_enhancements.apply_modifications_to_frames(
            match_frames, make_rust_exception_data(exception_data)
        )
        metrics.incr("rust_enhancements.modifications_run")
        return rust_enhanced_frames
    except Exception:
        logger.exception("failed running Rust Enhancements modifications")
        return None


def compare_rust_enhancers(
    frames: Sequence[dict[str, Any]], rust_enhanced_frames: RustEnhancedFrames | None
):
    """
    Compares the results of `rust_enhanced_frames` with the frame modifications
    applied by Python code directly to `frames`.

    This will log an internal error on every mismatch.
    """
    if rust_enhanced_frames:
        python_frames = list((get_path(f, "data", "category"), f.get("in_app")) for f in frames)

        if python_frames != rust_enhanced_frames:
            with sentry_sdk.push_scope() as scope:
                scope.set_extra("python_frames", python_frames)
                scope.set_extra("rust_enhanced_frames", rust_enhanced_frames)
                sentry_sdk.capture_message("Rust Enhancements mismatch")


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
        extra_fingerprint: str = "",
    ) -> None:
        """This applies the frame modifications to the frames itself. This does not affect grouping."""

        # Matching frames are used for matching rules
        match_frames = [create_match_frame(frame, platform) for frame in frames]

        rust_enhanced_frames = apply_rust_enhancements(
            self.rust_enhancements, match_frames, exception_data
        )

        if rust_enhanced_frames:
            for frame, (category, in_app) in zip(frames, rust_enhanced_frames):
                if in_app is not None:
                    set_in_app(frame, in_app)
                if category is not None:
                    set_path(frame, "data", "category", value=category)
            return
        else:
            logger.error("Rust enhancements were not applied successfully")

        in_memory_cache: dict[str, str] = {}

        # The extra fingerprint mostly makes sense during test execution when two different group configs
        # can share the same set of rules and bases
        stacktrace_fingerprint = _generate_stacktrace_fingerprint(
            match_frames, exception_data, extra_fingerprint, platform
        )
        # The most expensive part of creating groups is applying the rules to frames (next code block)
        cache_key = f"stacktrace_hash.{stacktrace_fingerprint}"
        use_cache = bool(stacktrace_fingerprint)
        if use_cache:
            frames_changed = _update_frames_from_cached_values(frames, cache_key, platform)
            if frames_changed:
                logger.debug("The frames have been loaded from the cache. Skipping some work.")
                compare_rust_enhancers(frames, rust_enhanced_frames)
                return

        with sentry_sdk.start_span(op="stacktrace_processing", description="apply_rules_to_frames"):
            for rule in self._modifier_rules:
                for idx, action in rule.get_matching_frame_actions(
                    match_frames, exception_data, in_memory_cache
                ):
                    # Both frames and match_frames are updated
                    action.apply_modifications_to_frame(frames, match_frames, idx, rule=rule)
            for frame, match_frame in zip(frames, match_frames):
                if (in_app := match_frame["in_app"]) is not None:
                    set_in_app(frame, in_app)

        if use_cache:
            _cache_changed_frame_values(frames, cache_key, platform)

        compare_rust_enhancers(frames, rust_enhanced_frames)

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


def _update_frames_from_cached_values(
    frames: Sequence[dict[str, Any]], cache_key: str, platform: str
) -> bool:
    """
    This will update the frames of the stacktrace if it's been cached.
    Returns True if the merged has correctly happened.
    """
    frames_changed = False
    changed_frames_values = cache.get(cache_key, {})

    # This helps tracking changes in the hit/miss ratio of the cache
    metrics.incr(
        f"{DATADOG_KEY}.cache.get",
        tags={"success": bool(changed_frames_values), "platform": platform},
    )
    if changed_frames_values:
        try:
            for frame, changed_frame_values in zip(frames, changed_frames_values):
                if changed_frame_values.get("in_app") is not None:
                    set_in_app(frame, changed_frame_values["in_app"])
                    frames_changed = True
                if changed_frame_values.get("category") is not None:
                    set_path(frame, "data", "category", value=changed_frame_values["category"])
                    frames_changed = True

            if frames_changed:
                logger.debug("We have merged the cached stacktrace to the incoming one.")
        except Exception:
            logger.exception(
                "We have failed to update the stacktrace from the cache. Not aborting execution.",
                extra={"platform": platform},
            )
            # We want tests to fail to prevent breaking the caching system without noticing
            if os.environ.get("PYTEST_CURRENT_TEST"):
                raise

    metrics.incr(
        f"{DATADOG_KEY}.merged_cached_values",
        tags={"success": frames_changed, "platform": platform},
    )
    return frames_changed


def _cache_changed_frame_values(
    frames: Sequence[dict[str, Any]], cache_key: str, platform: str
) -> None:
    """Store in the cache the values which have been modified for each frame."""
    caching_succeeded = False
    # Check that some other event has not already populated the cache
    if cache.get(cache_key):
        return

    try:
        # XXX: A follow up PR will be required to make sure that only a whitelisted set of parameters
        # are allowed to be modified in apply_modifications_to_frame, thus, not falling out of date with this
        changed_frames_values = [
            {
                "in_app": frame.get("in_app"),  # Based on FlagAction
                "category": get_path(frame, "data", "category"),  # Based on VarAction's
            }
            for frame in frames
        ]
        cache.set(cache_key, changed_frames_values)
        caching_succeeded = True
    except Exception:
        logger.exception("Failed to store changed frames in cache", extra={"platform": platform})

    metrics.incr(
        f"{DATADOG_KEY}.cache.set",
        tags={"success": caching_succeeded, "platform": platform},
    )


def _generate_stacktrace_fingerprint(
    stacktrace_match_frames: Sequence[dict[str, Any]],
    stacktrace_container: dict[str, Any],
    enhancements_dumps: str,
    platform: str,
) -> str:
    """Create a fingerprint for the stacktrace. Empty string if unsuccesful."""
    stacktrace_fingerprint = ""
    try:
        stacktrace_frames_fingerprint = _generate_match_frames_fingerprint(stacktrace_match_frames)
        stacktrace_type_value = _generate_stacktrace_container_fingerprint(stacktrace_container)
        # Hash of the three components involved for fingerprinting a stacktrace
        stacktrace_hash = md5()
        hash_value(
            stacktrace_hash,
            (stacktrace_frames_fingerprint, stacktrace_type_value, enhancements_dumps),
        )

        stacktrace_fingerprint = stacktrace_hash.hexdigest()
    except Exception:
        # This will create an error in Sentry to help us evaluate why it failed
        logger.exception(
            "Stacktrace hashing failure. Investigate and fix.", extra={"platform": platform}
        )
        # We want tests to fail to prevent breaking the caching system without noticing
        if os.environ.get("PYTEST_CURRENT_TEST"):
            raise

    # This will help us calculate the success ratio for fingerprint calculation
    metrics.incr(
        f"{DATADOG_KEY}.fingerprint",
        tags={
            "hashing_failure": stacktrace_fingerprint == "",
            "platform": platform,
        },
    )
    return stacktrace_fingerprint


def _generate_stacktrace_container_fingerprint(stacktrace_container: dict[str, Any]) -> str:
    stacktrace_type_value = ""
    if stacktrace_container:
        cont_type = stacktrace_container.get("type", "")
        cont_value = stacktrace_container.get("value", "")
        stacktrace_type_value = f"{cont_type}.{cont_value}"

    return stacktrace_type_value


def _generate_match_frames_fingerprint(match_frames: Sequence[dict[str, Any]]) -> str:
    """Fingerprint representing the stacktrace frames. Raises error if it fails."""
    stacktrace_hash = md5()
    for match_frame in match_frames:
        # We create the hash based on the match_frame since it does not
        # contain values like the `vars` which is not necessary for grouping
        hash_value(stacktrace_hash, match_frame)

    return stacktrace_hash.hexdigest()


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
