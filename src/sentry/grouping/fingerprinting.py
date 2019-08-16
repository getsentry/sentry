from __future__ import absolute_import

import six
import inspect

from parsimonious.grammar import Grammar, NodeVisitor
from parsimonious.exceptions import ParseError

from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.grouping.utils import get_rule_bool
from sentry.utils.safe import get_path
from sentry.utils.glob import glob_match


VERSION = 1


# Grammar is defined in EBNF syntax.
fingerprinting_grammar = Grammar(
    r"""

fingerprinting_rules = line+

line = _ (comment / rule / empty) newline?

rule = _ matchers _ follow _ fingerprint

matchers       = matcher+
matcher        = _ matcher_type sep argument
matcher_type   = "path" / "function" / "module" / "family" / "type" / "value" / "message" / "package" / "app"
argument       = quoted / unquoted

fingerprint    = fp_value+
fp_value        = _ fp_argument _ ","?
fp_argument    = quoted / unquoted_no_comma

comment        = ~r"#[^\r\n]*"

quoted         = ~r'"([^"\\]*(?:\\.[^"\\]*)*)"'
unquoted       = ~r"\S+"
unquoted_no_comma = ~r"((?:\{\{\s*\S+\s*\}\})|(?:[^\s,]+))"

follow  = "->"
sep     = ":"
space   = " "
empty   = ""
newline = ~r"[\r\n]"
_       = space*

"""
)


class InvalidFingerprintingConfig(Exception):
    pass


class EventAccess(object):
    def __init__(self, event):
        self.event = event
        self._exceptions = None
        self._frames = None
        self._messages = None

    def get_messages(self):
        if self._messages is None:
            self._messages = []
            message = get_path(self.event, "logentry", "formatted", filter=True)
            if message:
                self._messages.append(
                    {
                        "message": message,
                        "family": get_behavior_family_for_platform(self.event.get("platform")),
                    }
                )
        return self._messages

    def get_exceptions(self):
        if self._exceptions is None:
            self._exceptions = []
            for exc in get_path(self.event, "exception", "values", filter=True) or ():
                self._exceptions.append(
                    {
                        "type": exc.get("type"),
                        "value": exc.get("value"),
                        "family": get_behavior_family_for_platform(self.event.get("platform")),
                    }
                )
        return self._exceptions

    def get_frames(self, with_functions=False):
        from sentry.stacktraces.functions import get_function_name_for_frame

        if self._frames is None:
            self._frames = []

            def _push_frame(frame):
                platform = frame.get("platform") or self.event.get("platform")
                func = get_function_name_for_frame(frame, platform)
                self._frames.append(
                    {
                        "function": func or "<unknown>",
                        "path": frame.get("abs_path") or frame.get("filename"),
                        "module": frame.get("module"),
                        "family": get_behavior_family_for_platform(platform),
                        "package": frame.get("package"),
                        "app": frame.get("in_app"),
                    }
                )

            have_errors = False
            for exc in get_path(self.event, "exception", "values", filter=True) or ():
                for frame in get_path(exc, "stacktrace", "frames", filter=True) or ():
                    _push_frame(frame)
                have_errors = True

            if not have_errors:
                frames = get_path(self.event, "stacktrace", "frames", filter=True)
                if not frames:
                    threads = get_path(self.event, "threads", "values", filter=True)
                    if threads and len(threads) == 1:
                        frames = get_path(threads, 0, "stacktrace", "frames")
                for frame in frames or ():
                    _push_frame(frame)

        return self._frames

    def get_values(self, interface):
        if interface == "message":
            return self.get_messages()
        elif interface == "exception":
            return self.get_exceptions()
        elif interface == "frame":
            return self.get_frames()
        return []


class FingerprintingRules(object):
    def __init__(self, rules, changelog=None, version=None):
        if version is None:
            version = VERSION
        self.version = version
        self.rules = rules
        self.changelog = changelog

    def iter_rules(self):
        return iter(self.rules)

    def get_fingerprint_values_for_event(self, event):
        if not self.rules:
            return
        access = EventAccess(event)
        for rule in self.iter_rules():
            new_values = rule.get_fingerprint_values_for_event_access(access)
            if new_values is not None:
                return new_values

    @classmethod
    def _from_config_structure(cls, data):
        version = data["version"]
        if version != VERSION:
            raise ValueError("Unknown version")
        return cls(rules=[Rule._from_config_structure(x) for x in data["rules"]], version=version)

    def _to_config_structure(self):
        return {"version": self.version, "rules": [x._to_config_structure() for x in self.rules]}

    def to_json(self):
        return self._to_config_structure()

    @classmethod
    def from_json(cls, value):
        try:
            return cls._from_config_structure(value)
        except (LookupError, AttributeError, TypeError, ValueError) as e:
            raise ValueError("invalid fingerprinting config: %s" % e)

    @classmethod
    def from_config_string(self, s):
        try:
            tree = fingerprinting_grammar.parse(s)
        except ParseError as e:
            context = e.text[e.pos : e.pos + 33]
            if len(context) == 33:
                context = context[:-1] + "..."
            raise InvalidFingerprintingConfig(
                'Invalid syntax near "%s" (line %s, column %s)' % (context, e.line(), e.column())
            )
        return FingerprintingVisitor().visit(tree)


class Match(object):
    def __init__(self, key, pattern):
        self.key = key
        self.pattern = pattern

    @property
    def interface(self):
        if self.key == "message":
            return "message"
        elif self.key in ("type", "value"):
            return "exception"
        return "frame"

    def matches_value(self, value):
        if value is None:
            return False
        if self.key in ("path", "package"):
            if glob_match(
                value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True
            ):
                return True
            if not value.startswith("/") and glob_match(
                "/" + value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True
            ):
                return True
        elif self.key == "family":
            flags = self.pattern.split(",")
            if "all" in flags or value in flags:
                return True
        elif self.key == "app":
            ref_val = get_rule_bool(self.pattern)
            if ref_val is not None and ref_val == value:
                return True
        elif glob_match(value, self.pattern, ignorecase=self.key in ("message", "value")):
            return True
        return False

    def _to_config_structure(self):
        return [self.key, self.pattern]

    @classmethod
    def _from_config_structure(cls, obj):
        return cls(obj[0], obj[1])


class Rule(object):
    def __init__(self, matchers, fingerprint):
        self.matchers = matchers
        self.fingerprint = fingerprint

    def get_fingerprint_values_for_event_access(self, access):
        by_interface = {}
        for matcher in self.matchers:
            by_interface.setdefault(matcher.interface, []).append(matcher)

        for interface, matchers in six.iteritems(by_interface):
            for values in access.get_values(interface):
                if all(x.matches_value(values.get(x.key)) for x in matchers):
                    break
            else:
                return

        return self.fingerprint

    def _to_config_structure(self):
        return {
            "matchers": [x._to_config_structure() for x in self.matchers],
            "fingerprint": self.fingerprint,
        }

    @classmethod
    def _from_config_structure(cls, obj):
        return cls([Match._from_config_structure(x) for x in obj["matchers"]], obj["fingerprint"])


class FingerprintingVisitor(NodeVisitor):
    visit_comment = visit_empty = lambda *a: None

    def visit_comment(self, node, children):
        return node.text

    def visit_fingerprinting_rules(self, node, children):
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
        return FingerprintingRules(rules, inspect.cleandoc("\n".join(changelog)).rstrip() or None)

    def visit_line(self, node, children):
        _, line, _ = children
        comment_or_rule_or_empty = line[0]
        if comment_or_rule_or_empty:
            return comment_or_rule_or_empty

    def visit_rule(self, node, children):
        _, matcher, _, _, _, fingerprint = children
        return Rule(matcher, fingerprint)

    def visit_matcher(self, node, children):
        _, ty, _, argument = children
        return Match(ty, argument)

    def visit_matcher_type(self, node, children):
        return node.text

    def visit_argument(self, node, children):
        return children[0]

    visit_fp_argument = visit_argument

    def visit_fingerprint(self, node, children):
        return children

    def visit_fp_value(self, node, children):
        _, argument, _, _ = children
        return argument

    def visit_quoted(self, node, children):
        return node.text[1:-1].encode("ascii", "backslashreplace").decode("unicode-escape")

    def visit_unquoted(self, node, children):
        return node.text

    visit_unquoted_no_comma = visit_unquoted

    def generic_visit(self, node, children):
        return children
