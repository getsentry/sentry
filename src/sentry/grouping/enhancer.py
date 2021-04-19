import base64
import os
import zlib

import msgpack
from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar, NodeVisitor

from sentry import projectoptions
from sentry.grouping.component import GroupingComponent
from sentry.grouping.utils import get_rule_bool
from sentry.stacktraces.functions import set_in_app
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils.compat import zip
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path, set_path
from sentry.utils.strings import unescape_string

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
        return FrameMatch(key, arg, negated)


class FrameMatch(Match):
    def __init__(self, key, pattern, negated=False):
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
        # Path matches are always case insensitive
        if self.key in ("path", "package"):
            if self.key == "package":
                value = frame_data.get("package") or ""
            else:
                value = frame_data.get("abs_path") or frame_data.get("filename") or ""
            if glob_match(
                value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True
            ):
                return True
            if not value.startswith("/") and glob_match(
                "/" + value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True
            ):
                return True

            return False

        # families need custom handling as well
        if self.key == "family":
            flags = self.pattern.split(",")
            if "all" in flags:
                return True
            family = get_behavior_family_for_platform(frame_data.get("platform") or platform)
            return family in flags

        # in-app matching is just a bool
        if self.key == "app":
            ref_val = get_rule_bool(self.pattern)
            return ref_val is not None and ref_val == frame_data.get("in_app")

        # all other matches are case sensitive
        if self.key == "function":
            from sentry.stacktraces.functions import get_function_name_for_frame

            value = get_function_name_for_frame(frame_data, platform) or "<unknown>"
        elif self.key == "module":
            value = frame_data.get("module") or "<unknown>"
        elif self.key == "type":
            value = get_path(exception_data, "type") or "<unknown>"
        elif self.key == "value":
            value = get_path(exception_data, "value") or "<unknown>"
        elif self.key == "mechanism":
            value = get_path(exception_data, "mechanism", "type") or "<unknown>"
        elif self.key == "category":
            value = get_path(frame_data, "data", "category") or "<unknown>"
        else:
            # should not happen :)
            value = "<unknown>"

        return glob_match(value, self.pattern)

    def _to_config_structure(self, version):
        if self.key == "family":
            arg = "".join([_f for _f in [FAMILIES.get(x) for x in self.pattern.split(",")] if _f])
        elif self.key == "app":
            arg = {True: "1", False: "0"}.get(get_rule_bool(self.pattern), "")
        else:
            arg = self.pattern
        return ("!" if self.negated else "") + MATCH_KEYS[self.key] + arg


class CallerMatch(Match):
    def __init__(self, caller: FrameMatch):
        self.caller = caller

    @property
    def description(self):
        return f"[ {self.caller.description} ] |"

    def _to_config_structure(self, version):
        return f"[{self.caller._to_config_structure(version)}]|"

    def matches_frame(self, frames, idx, platform, exception_data):
        return idx > 0 and self.caller.matches_frame(frames, idx - 1, platform, exception_data)


class CalleeMatch(Match):
    def __init__(self, caller: FrameMatch):
        self.caller = caller

    @property
    def description(self):
        return f"| [ {self.caller.description} ]"

    def _to_config_structure(self, version):
        return f"|[{self.caller._to_config_structure(version)}]"

    def matches_frame(self, frames, idx, platform, exception_data):
        return idx < len(frames) - 1 and self.caller.matches_frame(
            frames, idx + 1, platform, exception_data
        )


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
    def __init__(self, rules, version=None, bases=None, id=None):
        self.id = id
        self.rules = rules
        if version is None:
            version = LATEST_VERSION
        self.version = version
        if bases is None:
            bases = []
        self.bases = bases

    def apply_modifications_to_frame(self, frames, platform, exception_data):
        """This applies the frame modifications to the frames itself.  This
        does not affect grouping.
        """
        for rule in self.iter_rules():
            for idx, action in rule.get_matching_frame_actions(frames, platform, exception_data):
                action.apply_modifications_to_frame(frames, idx, rule=rule)

    def update_frame_components_contributions(self, components, frames, platform, exception_data):
        stacktrace_state = StacktraceState()

        # Apply direct frame actions and update the stack state alongside
        for rule in self.iter_rules():
            for idx, action in rule.get_matching_frame_actions(frames, platform, exception_data):
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
        return EnhancmentsVisitor(bases, id).visit(tree)


class Rule:
    def __init__(self, matchers, actions):
        self.matchers = matchers
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
            if all(m.matches_frame(frames, idx, platform, exception_data) for m in self.matchers):
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
        return FrameMatch(ty, argument, bool(negation))

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
