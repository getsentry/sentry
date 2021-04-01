import os
import zlib
import base64
import msgpack
import inspect

from collections import defaultdict
from typing import Optional

from parsimonious.grammar import Grammar, NodeVisitor
from parsimonious.exceptions import ParseError

from sentry import projectoptions
from sentry.stacktraces.functions import get_function_name_for_frame, set_in_app
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.grouping.component import GroupingComponent
from sentry.grouping.utils import get_rule_bool
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path, set_path
from sentry.utils.compat import zip
from sentry.utils.strings import unescape_string


# Grammar is defined in EBNF syntax.
enhancements_grammar = Grammar(
    r"""

enhancements = line+

line = _ (comment / rule / empty) newline?

rule = _ matchers actions

matchers         = matcher+
matcher          = frame_matcher / range_matcher
frame_matcher    = _ negation? matcher_type sep argument
matcher_type     = ident / quoted_ident
range_matcher    = _ "[" _? frame_matcher? _? "|"? ~r" ?\.\. ?" "|"? _? frame_matcher? _? "]"

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


FAMILIES = {"native": "N", "javascript": "J", "all": "a"}
REVERSE_FAMILIES = {v: k for k, v in FAMILIES.items()}

VERSIONS = [1, 2]
LATEST_VERSION = VERSIONS[-1]
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

ACTIONS = ["group", "app", "prefix", "sentinel"]
ACTION_BITSIZE = {
    # version -> bit-size
    1: 4,
    2: 8,
}
assert len(ACTIONS) < 1 << max(ACTION_BITSIZE.values())
ACTION_FLAGS = {
    (True, None): 0,
    (True, "up"): 1,
    (True, "down"): 2,
    (False, None): 3,
    (False, "up"): 4,
    (False, "down"): 5,
}
REVERSE_ACTION_FLAGS = {v: k for k, v in ACTION_FLAGS.items()}


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


class InvalidEnhancerConfig(Exception):
    pass


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


class Action:
    def apply_modifications_to_frame(self, frames, idx, rule=None):
        pass

    def update_frame_components_contributions(self, components, frames, idx, rule=None):
        pass

    def modify_stacktrace_state(self, state, rule):
        pass

    @classmethod
    def _from_config_structure(cls, val, version):
        if isinstance(val, list):
            return VarAction(val[0], val[1])
        flag, range = REVERSE_ACTION_FLAGS[val >> ACTION_BITSIZE[version]]
        return FlagAction(ACTIONS[val & 0xF], flag, range)


class FlagAction(Action):
    def __init__(self, key, flag, range):
        self.key = key
        self.flag = flag
        self.range = range

    def __str__(self):
        return "{}{}{}".format(
            {"up": "^", "down": "v"}.get(self.range, ""),
            self.flag and "+" or "-",
            self.key,
        )

    def _to_config_structure(self, version):
        return ACTIONS.index(self.key) | (
            ACTION_FLAGS[self.flag, self.range] << ACTION_BITSIZE[version]
        )

    def _slice_to_range(self, seq, idx):
        if self.range is None:
            return [seq[idx]]
        elif self.range == "down":
            return seq[:idx]
        elif self.range == "up":
            return seq[idx + 1 :]
        return []

    def _in_app_changed(self, frame, component):
        orig_in_app = get_path(frame, "data", "orig_in_app")

        if orig_in_app is not None:
            if orig_in_app == -1:
                orig_in_app = None
            return orig_in_app != frame.get("in_app")
        else:
            return self.flag == component.contributes

    def apply_modifications_to_frame(self, frames, idx, rule=None):
        # Grouping is not stored on the frame
        if self.key == "group":
            return
        for frame in self._slice_to_range(frames, idx):
            if self.key == "app":
                set_in_app(frame, self.flag)

    def update_frame_components_contributions(self, components, frames, idx, rule=None):
        rule_hint = "stack trace rule"
        if rule:
            rule_hint = f"{rule_hint} ({rule.matcher_description})"

        sliced_components = self._slice_to_range(components, idx)
        sliced_frames = self._slice_to_range(frames, idx)
        for component, frame in zip(sliced_components, sliced_frames):
            if self.key == "group" and self.flag != component.contributes:
                component.update(
                    contributes=self.flag,
                    hint="{} by {}".format(self.flag and "un-ignored" or "ignored", rule_hint),
                )
            # The in app flag was set by `apply_modifications_to_frame`
            # but we want to add a hint if there is none yet.
            elif self.key == "app" and self._in_app_changed(frame, component):
                component.update(
                    hint="marked {} by {}".format(self.flag and "in-app" or "out of app", rule_hint)
                )

            elif self.key == "prefix":
                component.update(
                    is_prefix_frame=True, hint=f"marked as prefix frame by {rule_hint}"
                )

            elif self.key == "sentinel":
                component.update(
                    is_sentinel_frame=True, hint=f"marked as sentinel frame by {rule_hint}"
                )


class VarAction(Action):
    range = None

    _VALUE_PARSERS = {
        "max-frames": int,
        "min-frames": int,
        "invert-stacktrace": get_rule_bool,
        "category": lambda x: x,
    }

    _FRAME_VARIABLES = {"category"}

    def __init__(self, var, value):
        self.var = var

        try:
            self.value = VarAction._VALUE_PARSERS[var](value)
        except (ValueError, TypeError):
            raise InvalidEnhancerConfig(f"Invalid value '{value}' for '{var}'")
        except KeyError:
            raise InvalidEnhancerConfig(f"Unknown variable '{var}'")

    def __str__(self):
        return f"{self.var}={self.value}"

    def _to_config_structure(self, version):
        return [self.var, self.value]

    def modify_stacktrace_state(self, state, rule):
        if self.var not in VarAction._FRAME_VARIABLES:
            state.set(self.var, self.value, rule)

    def apply_modifications_to_frame(self, frames, idx, rule=None):
        if self.var == "category":
            frame = frames[idx]
            set_path(frame, "data", "category", value=self.value)


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
    def __init__(self, rules, changelog=None, version=None, bases=None, id=None):
        self.id = id
        self.rules = rules
        self.changelog = changelog
        if version is None:
            version = LATEST_VERSION
        self.version = version
        if bases is None:
            bases = []
        self.bases = bases

        self._matchers, self._rules_by_matcher = self._populate_matchers()

    def _populate_matchers(self):
        matchers = {}
        rules_by_matcher = defaultdict(list)
        for rule in self.iter_rules():
            for matcher in rule.matchers:
                rules_by_matcher[id(matcher)].append(rule)
                matchers[id(matcher)] = matcher

        matchers = sorted(matchers.values(), key=lambda m: 0 if isinstance(m, FrameMatch) else 1)

        return matchers, rules_by_matcher

    def _iter_matching_rules(self, frames, idx, platform, exception_data):
        unmatched_rules = set()
        rules_by_matcher = self._rules_by_matcher
        remaining_rules_per_matcher = {
            id(matcher): len(rules_by_matcher[id(matcher)]) for matcher in self._matchers
        }
        for matcher in self._matchers:

            if remaining_rules_per_matcher[id(matcher)] <= 0:
                continue

            if not matcher.matches_frame(frames, idx, platform, exception_data):
                # Can put all rules which use this matcher on the blocklist:
                for rule in rules_by_matcher[id(matcher)]:
                    unmatched_rules.add(id(rule))
                    for matcher in rule.matchers:
                        remaining_rules_per_matcher[id(matcher)] -= 1

        for rule in self.iter_rules():
            if rule.matchers and id(rule) not in unmatched_rules:
                for action in rule.actions:
                    yield action, rule

    def apply_modifications_to_frame(self, frames, platform, exception_data):
        """This applies the frame modifications to the frames itself.  This
        does not affect grouping.
        """
        for idx, _ in enumerate(frames):
            for action, rule in self._iter_matching_rules(frames, idx, platform, exception_data):
                action.apply_modifications_to_frame(frames, idx, rule=rule)

    def update_frame_components_contributions(self, components, frames, platform, exception_data):
        stacktrace_state = StacktraceState()

        # Apply direct frame actions and update the stack state alongside
        for idx, _ in enumerate(frames):
            for action, rule in self._iter_matching_rules(frames, idx, platform, exception_data):
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
            "changelog": self.changelog,
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
        return EnhancmentsVisitor(bases, id).visit(tree)


class Rule:
    def __init__(self, matchers, actions):
        self.matchers = matchers
        # FrameMatch matchers are faster than RangeMatch matchers, so apply
        # them first to bail out early.
        self._sorted_matchers = sorted(
            matchers, key=lambda m: 0 if isinstance(m, FrameMatch) else 1
        )
        self.actions = actions

    @property
    def matcher_description(self):
        rv = " ".join(x.description for x in self.matchers)
        for action in self.actions:
            rv = f"{rv} {action}"
        return rv

    def as_dict(self):
        matchers = {}
        for matcher in self.matchers:
            matchers[matcher.key] = matcher.pattern
        return {"match": matchers, "actions": [str(x) for x in self.actions]}

    def get_matching_frame_actions(self, frames, platform, exception_data=None):
        """Given a frame returns all the matching actions based on this rule.
        If the rule does not match `None` is returned.
        """
        if not self.matchers:
            return []

        rv = []

        for idx, frame in enumerate(frames):
            if all(
                m.matches_frame(frames, idx, platform, exception_data)
                for m in self._sorted_matchers
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


class EnhancmentsVisitor(NodeVisitor):
    visit_comment = visit_empty = lambda *a: None
    unwrapped_exceptions = (InvalidEnhancerConfig,)

    def __init__(self, bases, id=None):
        self.bases = bases
        self.id = id

    def visit_comment(self, node, children):
        return node.text

    def visit_enhancements(self, node, children):
        changelog = []
        rules = []
        in_header = True
        for child in children:
            if isinstance(child, str):
                if in_header and child[:2] == "##":
                    changelog.append(child[2:].rstrip())
                else:
                    in_header = False
            elif child is not None:
                rules.append(child)
                in_header = False
        return Enhancements(
            rules,
            inspect.cleandoc("\n".join(changelog)).rstrip() or None,
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

    def visit_matcher(self, node, children):
        return children[0]

    def visit_range_matcher(self, node, children):
        _, _, _, start, _, start_neighbouring, _, end_neighbouring, _, end, _, _ = children
        return RangeMatch(
            start[0] if start else None,
            end[0] if end else None,
            bool(start_neighbouring),
            bool(end_neighbouring),
        )

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
