from __future__ import annotations

import base64
import logging
import os
import re
import zlib
from collections.abc import Sequence
from dataclasses import dataclass
from functools import cached_property
from typing import Any, Literal

import msgpack
import sentry_sdk
import zstandard
from sentry_ophio.enhancers import AssembleResult as RustStacktraceResult
from sentry_ophio.enhancers import Cache as RustCache
from sentry_ophio.enhancers import Component as RustFrame
from sentry_ophio.enhancers import Enhancements as RustEnhancements

from sentry.grouping.component import FrameGroupingComponent, StacktraceGroupingComponent
from sentry.models.project import Project
from sentry.stacktraces.functions import set_in_app
from sentry.utils import metrics
from sentry.utils.safe import get_path, set_path

from .exceptions import InvalidEnhancerConfig
from .matchers import create_match_frame
from .parser import parse_enhancements
from .rules import EnhancementRule

logger = logging.getLogger(__name__)

# NOTE: The 1_000 here is pretty arbitrary. Our builtin base enhancements have about ~300 rules,
# So this leaves quite a bit of headroom for custom enhancement rules as well.
RUST_CACHE = RustCache(1_000)

# TODO: Version 2 can be removed once all events with that config have expired, 90 days after this
# comment is merged
VERSIONS = [2, 3]
DEFAULT_ENHANCEMENTS_VERSION = VERSIONS[-1]
DEFAULT_ENHANCEMENTS_BASE = "all-platforms:2023-01-11"

# A delimiter to insert between rulesets in the base64 represenation of enhancements (by spec,
# base64 strings never contain '#')
BASE64_ENHANCEMENTS_DELIMITER = b"#"

HINT_STACKTRACE_RULE_REGEX = re.compile(r"stack trace rule \((.+)\)$")

VALID_PROFILING_MATCHER_PREFIXES = (
    "stack.abs_path",
    "path",  # stack.abs_path alias
    "stack.module",
    "module",  # stack.module alias
    "stack.function",
    "function",  # stack.function alias
    "stack.package",
    "package",  # stack.package
)
VALID_PROFILING_ACTIONS_SET = frozenset(["+app", "-app"])


@dataclass
class EnhancementsConfigData:
    # Note: This is not an actual config, just a container to make it easier to pass data between
    # functions while loading a config.
    rules: list[EnhancementRule]
    rule_strings: list[str]
    rust_enhancements: RustEnhancements
    version: int | None = None
    bases: list[str] | None = None


# Hack to fake a subclass of `RustFrame` (which can't be directly subclassed because it's a
# rust-python hybrid)
def EmptyRustFrame() -> RustFrame:  # noqa
    return RustFrame(contributes=None)


def _merge_rust_enhancements(
    bases: list[str],
    rust_enhancements: RustEnhancements,
    type: Literal["classifier", "contributes"],
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
            base_rust_enhancements = (
                base.classifier_rust_enhancements
                if type == "classifier"
                else base.contributes_rust_enhancements
            )
            merged_rust_enhancements.extend_from(base_rust_enhancements)
    merged_rust_enhancements.extend_from(rust_enhancements)
    return merged_rust_enhancements


def _get_rust_enhancements(
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


# TODO: Convert this into a typeddict in ophio
RustExceptionData = dict[str, bytes | None]


def _make_rust_exception_data(
    exception_data: dict[str, Any] | None,
) -> RustExceptionData:
    exception_data = exception_data or {}
    rust_data = {
        "type": exception_data.get("type"),
        "value": exception_data.get("value"),
        "mechanism": get_path(exception_data, "mechanism", "type"),
    }

    # Convert string values to bytes
    for key, value in rust_data.items():
        if isinstance(value, str):
            rust_data[key] = value.encode("utf-8")

    return RustExceptionData(
        ty=rust_data["type"],
        value=rust_data["value"],
        mechanism=rust_data["mechanism"],
    )


def _can_use_hint(
    variant_name: str,
    frame_component: FrameGroupingComponent,
    hint: str | None,
    desired_hint_type: Literal["in-app", "contributes"],
) -> bool:
    # Prevent clobbering an existing hint with no hint
    if hint is None:
        return False

    frame_type = "in-app" if frame_component.in_app else "system"
    hint_type = "contributes" if "ignored" in hint else "in-app"

    # Don't use the hint if we've specifically asked for something different
    if hint_type != desired_hint_type:
        return False

    # System frames can't contribute to the app variant, no matter what +/-group rules say, so we
    # ignore the hint if it's about contributing since it's irrelevant
    if variant_name == "app" and frame_type == "system" and hint_type == "contributes":
        return False

    # Similarly, we don't need hints about marking frames in or out of app in the system stacktrace
    # because such changes don't actually have an effect there
    if variant_name == "system" and hint_type == "in-app":
        return False

    return True


def _add_rule_source_to_hint(hint: str | None, custom_rules: set[str]) -> str | None:
    """Add 'custom' or 'built-in' to the rule description in the given hint (if any)."""
    if not hint:
        return None

    def _add_type_to_rule(rule_regex_match: re.Match) -> str:
        rule_str = rule_regex_match.group(1)
        rule_type = "custom" if rule_str in custom_rules else "built-in"
        return f"{rule_type} stack trace rule ({rule_str})"

    return HINT_STACKTRACE_RULE_REGEX.sub(_add_type_to_rule, hint)


def _get_hint_for_frame(
    variant_name: str,
    frame: dict[str, Any],
    frame_component: FrameGroupingComponent,
    rust_frame: RustFrame,
    desired_hint_type: Literal["in-app", "contributes"],
    custom_rules: set[str],
) -> str | None:
    """
    Determine a hint to use for the frame, handling special-casing and precedence.
    """
    client_in_app = get_path(frame, "data", "client_in_app")
    rust_in_app = frame["in_app"]
    rust_hint = rust_frame.hint
    rust_hint_type = (
        None if rust_hint is None else "in-app" if rust_hint.startswith("marked") else "contributes"
    )
    incoming_hint = frame_component.hint

    if variant_name == "app" and desired_hint_type == "in-app":
        default_in_app_hint = "non app frame" if not frame_component.in_app else None
        client_in_app_hint = (
            f"marked {"in-app" if client_in_app else "out of app"} by the client"
            # Only create the hint if it's going to match the eventual outcome. Otherwise, we might
            # fall back to the client hint even though the client in-app value got overridden.
            if client_in_app is not None and client_in_app == rust_in_app
            else None
        )
        incoming_hint = client_in_app_hint or default_in_app_hint or incoming_hint

    can_use_rust_hint = _can_use_hint(variant_name, frame_component, rust_hint, desired_hint_type)
    can_use_incoming_hint = _can_use_hint(
        variant_name, frame_component, incoming_hint, desired_hint_type
    )

    # We don't want the rust enhancer taking credit for changing things if we know the value didn't
    # actually change. (This only happens with in-app hints, not contributes hints, because of the
    # weird (a.k.a. wrong) second condition in the rust enhancer's version of `in_app_changed`.)
    if variant_name == "app" and rust_hint_type == "in-app" and rust_in_app == client_in_app:
        can_use_rust_hint = False

    raw_hint = rust_hint if can_use_rust_hint else incoming_hint if can_use_incoming_hint else None

    # Add 'custom' or 'built-in' to any stacktrace rule description as appropriate
    return _add_rule_source_to_hint(raw_hint, custom_rules)


def _get_hint_for_stacktrace(
    rust_stacktrace_results: RustStacktraceResult, custom_rules: set[str]
) -> str | None:
    raw_hint = rust_stacktrace_results.hint

    if not raw_hint:
        return None

    # Add 'custom' or 'built-in' to any stacktrace rule description as appropriate
    return _add_rule_source_to_hint(raw_hint, custom_rules)


def _split_rules(
    rules: list[EnhancementRule],
) -> tuple[EnhancementsConfigData, EnhancementsConfigData]:
    """
    Given a list of EnhancementRules, each of which may have both classifier and contributes
    actions, split the rules into separate classifier and contributes rule lists, and return them
    along with each ruleset's corresponding RustEnhancements object.
    """
    # Rules which set `in_app` or `category` on frames
    classifier_rules = [
        rule
        for rule in (
            rule.as_classifier_rule()  # Only include classifier actions
            for rule in rules
            if rule.has_classifier_actions
        )
        if rule is not None  # mypy appeasment
    ]

    # Rules which set `contributes` on frames and/or the stacktrace
    contributes_rules = [
        rule
        for rule in (
            rule.as_contributes_rule()  # Only include contributes actions
            for rule in rules
            if rule.has_contributes_actions
        )
        if rule is not None  # mypy appeasment
    ]

    classifier_rule_strings = [rule.text for rule in classifier_rules]
    contributes_rule_strings = [rule.text for rule in contributes_rules]

    classifier_rules_text = "\n".join(classifier_rule_strings)
    contributes_rules_text = "\n".join(contributes_rule_strings)

    classifier_rust_enhancements = _get_rust_enhancements("config_string", classifier_rules_text)
    contributes_rust_enhancements = _get_rust_enhancements("config_string", contributes_rules_text)

    return (
        EnhancementsConfigData(
            classifier_rules, classifier_rule_strings, classifier_rust_enhancements
        ),
        EnhancementsConfigData(
            contributes_rules, contributes_rule_strings, contributes_rust_enhancements
        ),
    )


def _combine_hints(
    variant_name: str,
    frame_component: FrameGroupingComponent,
    in_app_hint: str | None,
    contributes_hint: str | None,
) -> str | None:
    """
    Given possible in-app and contributes hints, determine the frame's final hint.
    """
    frame_type = "in-app" if frame_component.in_app else "system"

    # In-app hints never apply to the system stacktrace, so even if the contributes hint is `None`,
    # it's the one we want
    if variant_name == "system":
        return contributes_hint

    # From here on out everything we're doing is for the app variant

    # System frames never contribute to the app stacktrace, so if they've already been marked out of
    # app, we don't care whether or not they're ignored (or un-ignored), because they weren't going
    # to count anyway.
    if frame_type == "system":
        return in_app_hint

    # If only one hint exists, return that one
    if in_app_hint and not contributes_hint:
        return in_app_hint
    if contributes_hint and not in_app_hint:
        return contributes_hint

    # If neither hint exists, return None
    if not in_app_hint and not contributes_hint:
        return None

    # Combine the hints in such as way that we get "marked in-app by xxx AND un-ignored by yyy" and
    # "marked in-app by xxx BUT ignored by yyy"
    conjunction = "and" if frame_component.contributes else "but"
    return f"{in_app_hint} {conjunction} {contributes_hint}"


def _is_valid_profiling_matcher(matchers: list[str]) -> bool:
    for matcher in matchers:
        if not matcher.startswith(VALID_PROFILING_MATCHER_PREFIXES):
            return False
    return True


def _is_valid_profiling_action(action: str) -> bool:
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
        if _is_valid_profiling_matcher(matchers) and _is_valid_profiling_action(action):
            filtered_rules.append(rule)
    return "\n".join(filtered_rules)


def get_enhancements_version(project: Project, grouping_config_id: str = "") -> int:
    """
    Decide whether the enhancements config should be from the latest version or the version before.
    Useful when transitioning between versions.

    See https://github.com/getsentry/sentry/pull/91695 for a version of this function which
    incorporates sampling.
    """
    return DEFAULT_ENHANCEMENTS_VERSION


class EnhancementsConfig:
    # NOTE: You must add a version to ``VERSIONS`` any time attributes are added
    # to this class, s.t. no enhancements lacking these attributes are loaded
    # from cache.
    # See ``GroupingConfigLoader._get_enhancements`` in src/sentry/grouping/api.py.

    def __init__(
        self,
        rules: list[EnhancementRule],
        split_enhancement_configs: (
            tuple[EnhancementsConfigData, EnhancementsConfigData] | None
        ) = None,
        version: int | None = None,
        bases: list[str] | None = None,
        id: str | None = None,
    ):
        self.id = id
        self.rules = rules
        self.version = version or DEFAULT_ENHANCEMENTS_VERSION
        self.bases = bases or []

        classifier_config, contributes_config = split_enhancement_configs or _split_rules(rules)

        self.classifier_rules = classifier_config.rules
        self.contributes_rules = contributes_config.rules
        self.classifier_rust_enhancements = _merge_rust_enhancements(
            self.bases, classifier_config.rust_enhancements, type="classifier"
        )
        self.contributes_rust_enhancements = _merge_rust_enhancements(
            self.bases, contributes_config.rust_enhancements, type="contributes"
        )

        # We store the rule strings individually in a set so it's quick to test if a given rule
        # mentioned in a hint is custom or built-in
        self.custom_rule_strings = set(
            classifier_config.rule_strings + contributes_config.rule_strings
        )

    def apply_category_and_updated_in_app_to_frames(
        self,
        frames: Sequence[dict[str, Any]],
        platform: str,
        exception_data: dict[str, Any],
    ) -> None:
        """
        Apply enhancement rules to each frame, adding a category (if any) and updating the `in_app`
        value if necessary.

        Both the category and `in_app` data will be used during grouping. The `in_app` values will
        also be persisted in the saved event, so they can be used in the UI and when determining
        things like suspect commits and suggested assignees.
        """
        # TODO: Fix this type to list[MatchFrame] once it's fixed in ophio
        match_frames: list[Any] = [create_match_frame(frame, platform) for frame in frames]
        rust_exception_data = _make_rust_exception_data(exception_data)

        with metrics.timer("grouping.enhancements.get_in_app") as metrics_timer_tags:
            metrics_timer_tags["split"] = True
            category_and_in_app_results = (
                self.classifier_rust_enhancements.apply_modifications_to_frames(
                    match_frames, rust_exception_data
                )
            )

        for frame, (category, in_app) in zip(frames, category_and_in_app_results):
            if in_app is not None:
                # If the `in_app` value changes as a result of this call, the original value (in
                # integer form) will be added to `frame.data` under the key "orig_in_app"
                set_in_app(frame, in_app)
            if category is not None:
                set_path(frame, "data", "category", value=category)

    def assemble_stacktrace_component(
        self,
        variant_name: str,
        frame_components: list[FrameGroupingComponent],
        frames: list[dict[str, Any]],
        platform: str | None,
        exception_data: dict[str, Any] | None = None,
    ) -> StacktraceGroupingComponent:
        with metrics.timer("grouping.enhancements.get_contributes_and_hint") as metrics_timer_tags:
            metrics_timer_tags.update({"split": True, "variant": variant_name})

            rust_exception_data = _make_rust_exception_data(exception_data)

            # Create a set of rust frames to which we can ask rust to add in-app hints. (We know all
            # hints generated by classifier enhancements are in-app by definition.)
            in_app_rust_frames = [EmptyRustFrame() for frame in frames]
            # TODO: Fix this type to list[MatchFrame] once it's fixed in ophio
            in_app_match_frames: list[Any] = [
                create_match_frame(frame, platform) for frame in frames
            ]
            # Only spend the time to get in-app hints if we might use them
            if variant_name == "app":
                self.classifier_rust_enhancements.assemble_stacktrace_component(
                    in_app_match_frames, rust_exception_data, in_app_rust_frames
                )

            # Do the same for contributes hints, this time using the contributes enhancements. These
            # rust frames will also collect `contributes` values, along with the `contributes` and
            # `hint` values for the stacktrace.
            contributes_rust_frames = [
                RustFrame(contributes=c.contributes) for c in frame_components
            ]
            contributes_match_frames = [
                # We don't want to include `orig_in_app` here because otherwise +/-group hints can
                # get clobbered by +/-app hints
                {**match_frame, "orig_in_app": None}
                for match_frame in in_app_match_frames
            ]
            rust_stacktrace_results = (
                self.contributes_rust_enhancements.assemble_stacktrace_component(
                    contributes_match_frames, rust_exception_data, contributes_rust_frames
                )
            )

        # Update frame components with results from rust
        for frame, frame_component, in_app_rust_frame, contributes_rust_frame in zip(
            frames, frame_components, in_app_rust_frames, contributes_rust_frames
        ):
            # System frames should never contribute in the app variant, so if that's what we have,
            # force `contribtues=False`, regardless of the rust results
            if variant_name == "app" and not frame_component.in_app:
                contributes = False
            else:
                contributes = bool(  # bool-ing this to please mypy
                    contributes_rust_frame.contributes
                )

            frame_component.update(contributes=contributes)

            in_app_hint = (
                _get_hint_for_frame(
                    variant_name,
                    frame,
                    frame_component,
                    in_app_rust_frame,
                    "in-app",
                    self.custom_rule_strings,
                )
                if variant_name == "app"
                else None  # In-app hints don't apply to the system stacktrace
            )
            contributes_hint = _get_hint_for_frame(
                variant_name,
                frame,
                frame_component,
                contributes_rust_frame,
                "contributes",
                self.custom_rule_strings,
            )
            hint = _combine_hints(variant_name, frame_component, in_app_hint, contributes_hint)

            frame_component.update(hint=hint)

        stacktrace_component = StacktraceGroupingComponent(
            values=frame_components,
            hint=rust_stacktrace_results.hint,
            contributes=rust_stacktrace_results.contributes,
        )

        return stacktrace_component

    def _get_base64_bytes_from_rules(self, rules: list[EnhancementRule]) -> bytes:
        pickled = msgpack.dumps(
            [self.version, self.bases, [rule._to_config_structure(self.version) for rule in rules]]
        )
        compressed_pickle = zstandard.compress(pickled)
        return base64.urlsafe_b64encode(compressed_pickle).strip(b"=")

    @cached_property
    def base64_string(self) -> str:
        """A base64 string representation of the enhancements object"""
        rulesets = [self.rules, self.classifier_rules, self.contributes_rules]

        # Create a base64 bytestring for each set of rules, and join them with a character we know
        # can never appear in base64. We do it this way rather than combining all three sets of
        # rules into a single bytestring because the rust enhancer only knows how to deal with
        # bytestrings encoding data of the form `[version, bases, rules]` (not
        # `[version, bases, rules, rules, rules]`).
        base64_bytes = BASE64_ENHANCEMENTS_DELIMITER.join(
            self._get_base64_bytes_from_rules(ruleset) for ruleset in rulesets
        )
        base64_str = base64_bytes.decode("ascii")
        return base64_str

    @classmethod
    def _get_config_from_base64_bytes(cls, bytes_str: bytes) -> EnhancementsConfigData:
        padded_bytes = bytes_str + b"=" * (4 - (len(bytes_str) % 4))

        try:
            compressed_pickle = base64.urlsafe_b64decode(padded_bytes)

            if compressed_pickle.startswith(b"\x28\xb5\x2f\xfd"):
                pickled = zstandard.decompress(compressed_pickle)
            else:
                pickled = zlib.decompress(compressed_pickle)

            config_structure = msgpack.loads(pickled, raw=False)
            version, bases, rules = config_structure
            if version not in VERSIONS:
                raise InvalidEnhancerConfig(f"Unknown enhancements version: {version}")

            rules = [EnhancementRule._from_config_structure(rule, version) for rule in rules]
            rust_enhancements = _get_rust_enhancements("config_structure", pickled)

        except (LookupError, AttributeError, TypeError, ValueError) as e:
            raise ValueError("invalid stack trace rule config: %s" % e)

        return EnhancementsConfigData(
            rules, [rule.text for rule in rules], rust_enhancements, version, bases
        )

    @classmethod
    def from_base64_string(
        cls, base64_string: str | bytes, referrer: str | None = None
    ) -> EnhancementsConfig:
        """Convert a base64 string into an `EnhancementsConfig` object"""

        with metrics.timer("grouping.enhancements.creation") as metrics_timer_tags:
            metrics_timer_tags.update({"source": "base64_string", "referrer": referrer})

            raw_bytes_str = (
                base64_string.encode("ascii", "ignore")
                if isinstance(base64_string, str)
                else base64_string
            )

            # Split the string to get encoded data for each set of rules: unsplit rules (i.e., rules
            # the way they're stored in project config), classifier rules, and contributes rules.
            # Older base64 strings - such as those stored in events created before rule-splitting
            # was introduced - will only have one part and thus will end up unchanged by the split.
            # (The delimiter is chosen specifically to be a character which can't appear in base64.)
            bytes_strs = raw_bytes_str.split(BASE64_ENHANCEMENTS_DELIMITER)
            configs = [cls._get_config_from_base64_bytes(bytes_str) for bytes_str in bytes_strs]

            unsplit_config = configs[0]
            split_configs = None

            if len(configs) == 3:
                split_configs = (configs[1], configs[2])

            version = unsplit_config.version
            bases = unsplit_config.bases

            metrics_timer_tags.update({"split": version == 3})

            return cls(
                rules=unsplit_config.rules,
                split_enhancement_configs=split_configs,
                version=version,
                bases=bases,
            )

    @classmethod
    @sentry_sdk.tracing.trace
    def from_rules_text(
        cls,
        rules_text: str,
        bases: list[str] | None = None,
        id: str | None = None,
        version: int | None = None,
        referrer: str | None = None,
    ) -> EnhancementsConfig:
        """Create an `EnhancementsConfig` object from a text blob containing stacktrace rules"""

        with metrics.timer("grouping.enhancements.creation") as metrics_timer_tags:
            metrics_timer_tags.update(
                {"split": version == 3, "source": "rules_text", "referrer": referrer}
            )

            return EnhancementsConfig(
                rules=parse_enhancements(rules_text),
                version=version,
                bases=bases,
                id=id,
            )


def _load_configs() -> dict[str, EnhancementsConfig]:
    enhancement_bases = {}
    configs_dir = os.path.join(os.path.abspath(os.path.dirname(__file__)), "enhancement-configs")
    for filename in os.listdir(configs_dir):
        if filename.endswith(".txt"):
            with open(os.path.join(configs_dir, filename), encoding="utf-8") as f:
                # Strip the extension
                filename = filename.replace(".txt", "")
                # We cannot use `:` in filenames on Windows but we already have ids with
                # `:` in their names hence this trickery.
                filename = filename.replace("@", ":")
                enhancements = EnhancementsConfig.from_rules_text(
                    f.read(), id=filename, referrer="default_rules"
                )
                enhancement_bases[filename] = enhancements
    return enhancement_bases


ENHANCEMENT_BASES = _load_configs()
del _load_configs

# TODO: Shim to cover the time period before events which have the old default enhancements name
# encoded in their base64 grouping config expire. Should be able to be deleted after Nov 2025. (Note
# that the new name is hard-coded, rather than a reference to `DEFAULT_ENHANCEMENTS_BASE`, because
# if we make a new default in the meantime, the old name should still point to
# `all-platforms:2023-01-11`.)
ENHANCEMENT_BASES["newstyle:2023-01-11"] = ENHANCEMENT_BASES["all-platforms:2023-01-11"]
