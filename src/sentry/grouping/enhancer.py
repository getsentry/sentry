from __future__ import absolute_import

import io
import os
import six
import zlib
import base64
import msgpack
import inspect

from parsimonious.grammar import Grammar, NodeVisitor
from parsimonious.exceptions import ParseError

from sentry import projectoptions
from sentry.stacktraces.functions import set_in_app
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.grouping.component import GroupingComponent
from sentry.grouping.utils import get_rule_bool
from sentry.utils.compat import implements_to_string
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path
from sentry.utils.compat import zip


# Grammar is defined in EBNF syntax.
enhancements_grammar = Grammar(
    r"""

enhancements = line+

line = _ (comment / rule / empty) newline?

rule = _ matchers actions

matchers         = matcher+
matcher          = _ negation? matcher_type sep argument
matcher_type     = key / quoted_key

key              = ~r"[a-zA-Z0-9_\.-]+"
quoted_key       = ~r"\"([a-zA-Z0-9_\.:-]+)\""

actions          = action+
action           = flag_action / var_action
var_action       = _ var_name _ "=" _ expr
var_name         = "max-frames" / "min-frames"
flag_action      = _ range? flag flag_action_name
flag_action_name = "group" / "app"
flag             = "+" / "-"
range            = "^" / "v"
expr             = int
int              = ~r"[0-9]+"

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
REVERSE_FAMILIES = dict((v, k) for k, v in six.iteritems(FAMILIES))

VERSION = 1
MATCH_KEYS = {
    "path": "p",
    "function": "f",
    "module": "m",
    "family": "F",
    "package": "P",
    "app": "a",
}
SHORT_MATCH_KEYS = dict((v, k) for k, v in six.iteritems(MATCH_KEYS))

ACTIONS = ["group", "app"]
ACTION_FLAGS = {
    (True, None): 0,
    (True, "up"): 1,
    (True, "down"): 2,
    (False, None): 3,
    (False, "up"): 4,
    (False, "down"): 5,
}
REVERSE_ACTION_FLAGS = dict((v, k) for k, v in six.iteritems(ACTION_FLAGS))


MATCHERS = {
    # discover field names
    "stack.module": "module",
    "stack.abs_path": "path",
    "stack.package": "package",
    "stack.function": "function",
    # fingerprinting shortened fields
    "module": "module",
    "path": "path",
    "package": "package",
    "function": "function",
    # fingerprinting specific fields
    "family": "family",
    "app": "app",
}


class InvalidEnhancerConfig(Exception):
    pass


class Match(object):
    def __init__(self, key, pattern, negated=False):
        try:
            self.key = MATCHERS[key]
        except KeyError:
            raise InvalidEnhancerConfig("Unknown matcher '%s'" % key)
        self.pattern = pattern
        self.negated = negated

    @property
    def description(self):
        return "%s:%s" % (
            self.key,
            self.pattern.split() != [self.pattern] and '"%s"' % self.pattern or self.pattern,
        )

    def matches_frame(self, frame_data, platform):
        rv = self._positive_frame_match(frame_data, platform)
        if self.negated:
            rv = not rv
        return rv

    def _positive_frame_match(self, frame_data, platform):
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
        else:
            # should not happen :)
            value = "<unknown>"
        return glob_match(value, self.pattern)

    def _to_config_structure(self):
        if self.key == "family":
            arg = "".join([_f for _f in [FAMILIES.get(x) for x in self.pattern.split(",")] if _f])
        elif self.key == "app":
            arg = {True: "1", False: "0"}.get(get_rule_bool(self.pattern), "")
        else:
            arg = self.pattern
        return ("!" if self.negated else "") + MATCH_KEYS[self.key] + arg

    @classmethod
    def _from_config_structure(cls, obj):
        val = obj
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
        return cls(key, arg, negated)


class Action(object):
    def apply_modifications_to_frame(self, frames, idx):
        pass

    def update_frame_components_contributions(self, components, frames, idx, rule=None):
        pass

    def modify_stacktrace_state(self, state, rule):
        pass

    @classmethod
    def _from_config_structure(cls, val):
        if isinstance(val, list):
            return VarAction(val[0], val[1])
        flag, range = REVERSE_ACTION_FLAGS[val >> 4]
        return FlagAction(ACTIONS[val & 0xF], flag, range)


@implements_to_string
class FlagAction(Action):
    def __init__(self, key, flag, range):
        self.key = key
        self.flag = flag
        self.range = range

    def __str__(self):
        return "%s%s%s" % (
            {"up": "^", "down": "v"}.get(self.range, ""),
            self.flag and "+" or "-",
            self.key,
        )

    def _to_config_structure(self):
        return ACTIONS.index(self.key) | (ACTION_FLAGS[self.flag, self.range] << 4)

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

    def apply_modifications_to_frame(self, frames, idx):
        # Grouping is not stored on the frame
        if self.key == "group":
            return
        for frame in self._slice_to_range(frames, idx):
            if self.key == "app":
                set_in_app(frame, self.flag)

    def update_frame_components_contributions(self, components, frames, idx, rule=None):
        rule_hint = "grouping enhancement rule"
        if rule:
            rule_hint = "%s (%s)" % (rule_hint, rule.matcher_description)

        sliced_components = self._slice_to_range(components, idx)
        sliced_frames = self._slice_to_range(frames, idx)
        for component, frame in zip(sliced_components, sliced_frames):
            if self.key == "group" and self.flag != component.contributes:
                component.update(
                    contributes=self.flag,
                    hint="%s by %s" % (self.flag and "un-ignored" or "ignored", rule_hint),
                )
            # The in app flag was set by `apply_modifications_to_frame`
            # but we want to add a hint if there is none yet.
            elif self.key == "app" and self._in_app_changed(frame, component):
                component.update(
                    hint="marked %s by %s" % (self.flag and "in-app" or "out of app", rule_hint)
                )


@implements_to_string
class VarAction(Action):
    range = None

    def __init__(self, var, value):
        self.var = var
        self.value = value

    def __str__(self):
        return "%s=%s" % (self.var, self.value)

    def _to_config_structure(self):
        return [self.var, self.value]

    def modify_stacktrace_state(self, state, rule):
        state.set(self.var, self.value, rule)


class StacktraceState(object):
    def __init__(self):
        self.vars = {"max-frames": 0, "min-frames": 0}
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
        return "%s by grouping enhancement rule (%s)" % (hint, description)


class Enhancements(object):
    def __init__(self, rules, changelog=None, version=None, bases=None, id=None):
        self.id = id
        self.rules = rules
        self.changelog = changelog
        if version is None:
            version = VERSION
        self.version = version
        if bases is None:
            bases = []
        self.bases = bases

    def apply_modifications_to_frame(self, frames, platform):
        """This applies the frame modifications to the frames itself.  This
        does not affect grouping.
        """
        for rule in self.iter_rules():
            for idx, frame in enumerate(frames):
                actions = rule.get_matching_frame_actions(frame, platform)
                for action in actions or ():
                    action.apply_modifications_to_frame(frames, idx)

    def update_frame_components_contributions(self, components, frames, platform):
        stacktrace_state = StacktraceState()

        # Apply direct frame actions and update the stack state alongside
        for rule in self.iter_rules():
            for idx, (component, frame) in enumerate(zip(components, frames)):
                actions = rule.get_matching_frame_actions(frame, platform)
                for action in actions or ():
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

    def assemble_stacktrace_component(self, components, frames, platform, **kw):
        """This assembles a stacktrace grouping component out of the given
        frame components and source frames.  Internally this invokes the
        `update_frame_components_contributions` method but also handles cases
        where the entire stacktrace should be discarded.
        """
        hint = None
        contributes = None
        stacktrace_state = self.update_frame_components_contributions(components, frames, platform)

        min_frames = stacktrace_state.get("min-frames")
        if min_frames > 0:
            total_contributes = sum(x.contributes for x in components)
            if 0 < total_contributes < min_frames:
                hint = (
                    "discarded because stacktrace only contains %d "
                    "frame%s which is under the configured threshold"
                    % (total_contributes, "s" if total_contributes != 1 else "")
                )
                hint = stacktrace_state.add_to_hint(hint, var="min-frames")
                contributes = False

        return GroupingComponent(
            id="stacktrace", values=components, hint=hint, contributes=contributes, **kw
        )

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
        return [self.version, self.bases, [x._to_config_structure() for x in self.rules]]

    def dumps(self):
        return (
            base64.urlsafe_b64encode(zlib.compress(msgpack.dumps(self._to_config_structure())))
            .decode("ascii")
            .strip(u"=")
        )

    def iter_rules(self):
        for base in self.bases:
            base = ENHANCEMENT_BASES.get(base)
            if base:
                for rule in base.iter_rules():
                    yield rule
        for rule in self.rules:
            yield rule

    @classmethod
    def _from_config_structure(cls, data):
        version, bases, rules = data
        if version != VERSION:
            raise ValueError("Unknown version")
        return cls(
            rules=[Rule._from_config_structure(x) for x in rules], version=version, bases=bases
        )

    @classmethod
    def loads(cls, data):
        if isinstance(data, six.text_type):
            data = data.encode("ascii", "ignore")
        padded = data + b"=" * (4 - (len(data) % 4))
        try:
            return cls._from_config_structure(
                msgpack.loads(zlib.decompress(base64.urlsafe_b64decode(padded)), raw=False)
            )
        except (LookupError, AttributeError, TypeError, ValueError) as e:
            raise ValueError("invalid grouping enhancement config: %s" % e)

    @classmethod
    def from_config_string(self, s, bases=None, id=None):
        try:
            tree = enhancements_grammar.parse(s)
        except ParseError as e:
            context = e.text[e.pos : e.pos + 33]
            if len(context) == 33:
                context = context[:-1] + "..."
            raise InvalidEnhancerConfig(
                'Invalid syntax near "%s" (line %s, column %s)' % (context, e.line(), e.column())
            )
        return EnhancmentsVisitor(bases, id).visit(tree)


class Rule(object):
    def __init__(self, matchers, actions):
        self.matchers = matchers
        self.actions = actions

    @property
    def matcher_description(self):
        rv = " ".join(x.description for x in self.matchers)
        for action in self.actions:
            rv = "%s %s" % (rv, action)
        return rv

    def as_dict(self):
        matchers = {}
        for matcher in self.matchers:
            matchers[matcher.key] = matcher.pattern
        return {"match": matchers, "actions": [six.text_type(x) for x in self.actions]}

    def get_matching_frame_actions(self, frame_data, platform):
        """Given a frame returns all the matching actions based on this rule.
        If the rule does not match `None` is returned.
        """
        if self.matchers and all(m.matches_frame(frame_data, platform) for m in self.matchers):
            return self.actions

    def _to_config_structure(self):
        return [
            [x._to_config_structure() for x in self.matchers],
            [x._to_config_structure() for x in self.actions],
        ]

    @classmethod
    def _from_config_structure(cls, tuple):
        return Rule(
            [Match._from_config_structure(x) for x in tuple[0]],
            [Action._from_config_structure(x) for x in tuple[1]],
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
            if isinstance(child, six.string_types):
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
        _, negation, ty, _, argument = children
        return Match(ty, argument, bool(negation))

    def visit_matcher_type(self, node, children):
        return node.text

    def visit_argument(self, node, children):
        return children[0]

    def visit_var(self, node, children):
        _, var_name, _, _, _, arg = children
        return Action("set_var", (var_name, arg))

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

    def visit_expr(self, node, children):
        return children[0]

    def visit_int(self, node, children):
        return int(node.text)

    def visit_quoted(self, node, children):
        return node.text[1:-1].encode("ascii", "backslashreplace").decode("unicode-escape")

    def visit_unquoted(self, node, children):
        return node.text

    def generic_visit(self, node, children):
        return children

    def visit_key(self, node, children):
        return node.text

    def visit_quoted_key(self, node, children):
        # leading ! are used to indicate negation. make sure they don't appear.
        return node.match.groups()[0].lstrip("!")


def _load_configs():
    rv = {}
    base = os.path.join(os.path.abspath(os.path.dirname(__file__)), "enhancement-configs")
    for fn in os.listdir(base):
        if fn.endswith(".txt"):
            with io.open(os.path.join(base, fn), "rt", encoding="utf-8") as f:
                # We cannot use `:` in filenames on Windows but we already have ids with
                # `:` in their names hence this trickery.
                fn = fn.replace("@", ":")
                rv[fn[:-4]] = Enhancements.from_config_string(f.read(), id=fn[:-4])
    return rv


ENHANCEMENT_BASES = _load_configs()
del _load_configs
