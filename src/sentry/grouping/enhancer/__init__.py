from __future__ import annotations

import base64
import logging
import os
import zlib
from hashlib import md5
from typing import Any, Sequence

import msgpack
import sentry_sdk
from django.core.cache import cache
from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar
from parsimonious.nodes import NodeVisitor

from sentry import projectoptions
from sentry.grouping.component import GroupingComponent
from sentry.stacktraces.functions import set_in_app
from sentry.utils import metrics
from sentry.utils.hashlib import hash_value
from sentry.utils.safe import get_path, set_path
from sentry.utils.strings import unescape_string

from .actions import Action, FlagAction, VarAction
from .exceptions import InvalidEnhancerConfig
from .matchers import (
    CalleeMatch,
    CallerMatch,
    ExceptionFieldMatch,
    FrameMatch,
    Match,
    create_match_frame,
)

DATADOG_KEY = "save_event.stacktrace"
logger = logging.getLogger(__name__)

# Grammar is defined in EBNF syntax.
enhancements_grammar = Grammar(
    r"""

enhancements = line+

line = _ (comment / rule / empty) newline?

rule = _ matchers actions


matchers         = caller_matcher? frame_matcher+ callee_matcher?
frame_matcher    = _ negation? matcher_type sep argument
matcher_type     = ident / quoted_ident
caller_matcher   = _ "[" _ frame_matcher _ "]" _ "|"
callee_matcher   = _ "|" _ "[" _ frame_matcher _ "]"

actions          = action+
action           = flag_action / var_action
var_action       = _ var_name _ "=" _ ident
var_name         = "max-frames" / "min-frames" / "invert-stacktrace" / "category"
flag_action      = _ range? flag flag_action_name
flag_action_name = "group" / "app" / "prefix" / "sentinel"
flag             = "+" / "-"
range            = "^" / "v"

ident            = ~r"[a-zA-Z0-9_\.-]+"
quoted_ident     = ~r"\"([a-zA-Z0-9_\.:-]+)\""

comment          = ~r"#[^\r\n]*"

argument         = quoted / unquoted
quoted           = ~r'"([^"\\]*(?:\\.[^"\\]*)*)"'
unquoted         = ~r"\S+"

sep      = ":"
space    = " "
empty    = ""
negation = "!"
newline  = ~r"[\r\n]"
_        = space*

"""
)


VERSIONS = [1, 2]
LATEST_VERSION = VERSIONS[-1]


class StacktraceState:
    def __init__(self):
        self.vars = {"max-frames": 0, "min-frames": 0, "invert-stacktrace": 0}
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


class Enhancements:

    # NOTE: You must add a version to ``VERSIONS`` any time attributes are added
    # to this class, s.t. no enhancements lacking these attributes are loaded
    # from cache.
    # See ``_get_project_enhancements_config`` in src/sentry/grouping/api.py.

    def __init__(self, rules, version=None, bases=None, id=None):
        self.id = id
        self.rules = rules
        if version is None:
            version = LATEST_VERSION
        self.version = version
        if bases is None:
            bases = []
        self.bases = bases

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
        in_memory_cache: dict[str, str] = {}

        # Matching frames are used for matching rules
        match_frames = [create_match_frame(frame, platform) for frame in frames]
        # The extra fingerprint mostly makes sense during test execution when two different group configs
        # can share the same set of rules and bases
        stacktrace_fingerprint = _generate_stacktrace_fingerprint(
            match_frames, exception_data, f"{extra_fingerprint}.{self.dumps()}", platform
        )
        # The most expensive part of creating groups is applying the rules to frames (next code block)
        cache_key = f"stacktrace_hash.{stacktrace_fingerprint}"
        use_cache = bool(stacktrace_fingerprint)
        if use_cache:
            frames_changed = _update_frames_from_cached_values(frames, cache_key, platform)
            if frames_changed:
                logger.debug("The frames have been loaded from the cache. Skipping some work.")
                return

        with sentry_sdk.start_span(op="stacktrace_processing", description="apply_rules_to_frames"):
            for rule in self._modifier_rules:
                for idx, action in rule.get_matching_frame_actions(
                    match_frames, platform, exception_data, in_memory_cache
                ):
                    # Both frames and match_frames are updated
                    action.apply_modifications_to_frame(frames, match_frames, idx, rule=rule)

        if use_cache:
            _cache_changed_frame_values(frames, cache_key, platform)

    def update_frame_components_contributions(self, components, frames, platform, exception_data):
        in_memory_cache: dict[str, str] = {}

        match_frames = [create_match_frame(frame, platform) for frame in frames]

        stacktrace_state = StacktraceState()
        # Apply direct frame actions and update the stack state alongside
        for rule in self._updater_rules:

            for idx, action in rule.get_matching_frame_actions(
                match_frames, platform, exception_data, in_memory_cache
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

    def assemble_stacktrace_component(
        self, components, frames, platform, exception_data=None, **kw
    ):
        """This assembles a stacktrace grouping component out of the given
        frame components and source frames.  Internally this invokes the
        `update_frame_components_contributions` method but also handles cases
        where the entire stacktrace should be discarded.
        """
        hint = None
        contributes = None
        stacktrace_state = self.update_frame_components_contributions(
            components, frames, platform, exception_data
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

        inverted_hierarchy = stacktrace_state.get("invert-stacktrace")
        component = GroupingComponent(
            id="stacktrace", values=components, hint=hint, contributes=contributes, **kw
        )

        return component, inverted_hierarchy

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

    def dumps(self):
        return (
            base64.urlsafe_b64encode(zlib.compress(msgpack.dumps(self._to_config_structure())))
            .decode("ascii")
            .strip("=")
        )

    def iter_rules(self):
        for base in self.bases:
            base = ENHANCEMENT_BASES.get(base)
            if base:
                yield from base.iter_rules()
        yield from self.rules

    @classmethod
    def _from_config_structure(cls, data):
        version, bases, rules = data
        if version not in VERSIONS:
            raise ValueError("Unknown version")
        return cls(
            rules=[Rule._from_config_structure(x, version=version) for x in rules],
            version=version,
            bases=bases,
        )

    @classmethod
    def loads(cls, data):
        if isinstance(data, str):
            data = data.encode("ascii", "ignore")
        padded = data + b"=" * (4 - (len(data) % 4))
        try:
            return cls._from_config_structure(
                msgpack.loads(zlib.decompress(base64.urlsafe_b64decode(padded)), raw=False)
            )
        except (LookupError, AttributeError, TypeError, ValueError) as e:
            raise ValueError("invalid stack trace rule config: %s" % e)

    @classmethod
    def from_config_string(self, s, bases=None, id=None):
        try:
            tree = enhancements_grammar.parse(s)
        except ParseError as e:
            context = e.text[e.pos : e.pos + 33]
            if len(context) == 33:
                context = context[:-1] + "..."
            raise InvalidEnhancerConfig(
                f'Invalid syntax near "{context}" (line {e.line()}, column {e.column()})'
            )
        return EnhancementsVisitor(bases, id).visit(tree)


class Rule:
    def __init__(self, matchers, actions):
        self.matchers = matchers

        self._exception_matchers = []
        self._other_matchers = []
        for matcher in matchers:
            if isinstance(matcher, ExceptionFieldMatch):
                self._exception_matchers.append(matcher)
            else:
                self._other_matchers.append(matcher)

        self.actions = actions
        self._is_updater = any(action.is_updater for action in actions)
        self._is_modifier = any(action.is_modifier for action in actions)

    @property
    def matcher_description(self):
        rv = " ".join(x.description for x in self.matchers)
        for action in self.actions:
            rv = f"{rv} {action}"
        return rv

    def _as_modifier_rule(self) -> Rule | None:
        actions = [action for action in self.actions if action.is_modifier]
        if actions:
            return Rule(self.matchers, actions)
        else:
            return None

    def _as_updater_rule(self) -> Rule | None:
        actions = [action for action in self.actions if action.is_updater]
        if actions:
            return Rule(self.matchers, actions)
        else:
            return None

    def as_dict(self):
        matchers = {}
        for matcher in self.matchers:
            matchers[matcher.key] = matcher.pattern
        return {"match": matchers, "actions": [str(x) for x in self.actions]}

    def get_matching_frame_actions(
        self,
        match_frames: Sequence[dict[str, Any]],
        platform: str,
        exception_data: dict[str, Any],
        in_memory_cache: dict[str, str],
    ) -> list[tuple[int, Action]]:
        """Given a frame returns all the matching actions based on this rule.
        If the rule does not match `None` is returned.
        """
        if not self.matchers:
            return []

        # 1 - Check if exception matchers match
        for m in self._exception_matchers:
            if not m.matches_frame(match_frames, None, platform, exception_data, in_memory_cache):
                return []

        rv = []

        # 2 - Check if frame matchers match
        for idx, _ in enumerate(match_frames):
            if all(
                m.matches_frame(match_frames, idx, platform, exception_data, in_memory_cache)
                for m in self._other_matchers
            ):
                for action in self.actions:
                    rv.append((idx, action))

        return rv

    def _to_config_structure(self, version):
        return [
            [x._to_config_structure(version) for x in self.matchers],
            [x._to_config_structure(version) for x in self.actions],
        ]

    @classmethod
    def _from_config_structure(cls, tuple, version):
        return Rule(
            [Match._from_config_structure(x, version) for x in tuple[0]],
            [Action._from_config_structure(x, version) for x in tuple[1]],
        )


class EnhancementsVisitor(NodeVisitor):
    visit_comment = visit_empty = lambda *a: None
    unwrapped_exceptions = (InvalidEnhancerConfig,)

    def __init__(self, bases, id=None):
        self.bases = bases
        self.id = id

    def visit_enhancements(self, node, children):
        rules = []
        for child in children:
            if not isinstance(child, str) and child is not None:
                rules.append(child)

        return Enhancements(
            rules,
            bases=self.bases,
            id=self.id,
        )

    def visit_line(self, node, children):
        _, line, _ = children
        comment_or_rule_or_empty = line[0]
        if comment_or_rule_or_empty:
            return comment_or_rule_or_empty

    def visit_rule(self, node, children):
        _, matcher, actions = children
        return Rule(matcher, actions)

    def visit_matchers(self, node, children):
        caller_matcher, frame_matchers, callee_matcher = children
        return caller_matcher + frame_matchers + callee_matcher

    def visit_caller_matcher(self, node, children):
        _, _, _, inner, _, _, _, _ = children
        return CallerMatch(inner)

    def visit_callee_matcher(self, node, children):
        _, _, _, _, _, inner, _, _ = children
        return CalleeMatch(inner)

    def visit_frame_matcher(self, node, children):
        _, negation, ty, _, argument = children
        return FrameMatch.from_key(ty, argument, bool(negation))

    def visit_matcher_type(self, node, children):
        return node.text

    def visit_argument(self, node, children):
        return children[0]

    def visit_action(self, node, children):
        return children[0]

    def visit_flag_action(self, node, children):
        _, rng, flag, action_name = children
        return FlagAction(action_name, flag, rng[0] if rng else None)

    def visit_flag_action_name(self, node, children):
        return node.text

    def visit_var_action(self, node, children):
        _, var_name, _, _, _, arg = children
        return VarAction(var_name, arg)

    def visit_var_name(self, node, children):
        return node.text

    def visit_flag(self, node, children):
        return node.text == "+"

    def visit_range(self, node, children):
        if node.text == "^":
            return "up"
        return "down"

    def visit_quoted(self, node, children):
        return unescape_string(node.text[1:-1])

    def visit_unquoted(self, node, children):
        return node.text

    def generic_visit(self, node, children):
        return children

    def visit_ident(self, node, children):
        return node.text

    def visit_quoted_ident(self, node, children):
        # leading ! are used to indicate negation. make sure they don't appear.
        return node.match.groups()[0].lstrip("!")


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
        except Exception as error:
            logger.exception(
                "We have failed to update the stacktrace from the cache. Not aborting execution.",
                extra={"platform": platform},
            )
            # We want tests to fail to prevent breaking the caching system without noticing
            if os.environ.get("PYTEST_CURRENT_TEST"):
                raise error

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
    except Exception as error:
        # This will create an error in Sentry to help us evaluate why it failed
        logger.exception(
            "Stacktrace hashing failure. Investigate and fix.", extra={"platform": platform}
        )
        # We want tests to fail to prevent breaking the caching system without noticing
        if os.environ.get("PYTEST_CURRENT_TEST"):
            raise error

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


def _load_configs():
    rv = {}
    base = os.path.join(os.path.abspath(os.path.dirname(__file__)), "enhancement-configs")
    for fn in os.listdir(base):
        if fn.endswith(".txt"):
            with open(os.path.join(base, fn), encoding="utf-8") as f:
                # We cannot use `:` in filenames on Windows but we already have ids with
                # `:` in their names hence this trickery.
                fn = fn.replace("@", ":")
                rv[fn[:-4]] = Enhancements.from_config_string(f.read(), id=fn[:-4])
    return rv


ENHANCEMENT_BASES = _load_configs()
del _load_configs
