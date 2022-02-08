import inspect

from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar, NodeVisitor

from sentry.grouping.utils import get_rule_bool
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path
from sentry.utils.strings import unescape_string

VERSION = 1


# Grammar is defined in EBNF syntax.
fingerprinting_grammar = Grammar(
    r"""

fingerprinting_rules = line+

line = _ (comment / rule / empty) newline?

rule = _ matchers _ follow _ fingerprint

matchers       = matcher+
matcher        = _ negation? matcher_type sep argument
matcher_type   = key / quoted_key
argument       = quoted / unquoted

key                  = ~r"[a-zA-Z0-9_\.-]+"
quoted_key           = ~r"\"([a-zA-Z0-9_\.:-]+)\""

fingerprint    = fp_value+
fp_value        = _ fp_argument _ ","?
fp_argument    = fp_attribute / quoted / unquoted_no_comma
fp_attribute   = key "=" quoted

comment        = ~r"#[^\r\n]*"

quoted         = ~r'"([^"\\]*(?:\\.[^"\\]*)*)"'
unquoted       = ~r"\S+"
unquoted_no_comma = ~r"((?:\{\{\s*\S+\s*\}\})|(?:[^\s\{,]+))"

follow   = "->"
sep      = ":"
space    = " "
empty    = ""
negation = "!"
newline  = ~r"[\r\n]"
_        = space*

"""
)


class InvalidFingerprintingConfig(Exception):
    pass


def get_crashing_thread(threads):
    if threads is None:
        return None
    if len(threads) == 1:
        return threads[0]
    filtered = [x for x in threads if x and x.get("crashed")]
    if len(filtered) == 1:
        return filtered[0]
    filtered = [x for x in threads if x and x.get("current")]
    if len(filtered) == 1:
        return filtered[0]


class EventAccess:
    def __init__(self, event):
        self.event = event
        self._exceptions = None
        self._frames = None
        self._messages = None
        self._log_info = None
        self._toplevel = None
        self._tags = None

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

    def get_log_info(self):
        if self._log_info is None:
            log_info = {}
            logger = get_path(self.event, "logger", filter=True)
            if logger:
                log_info["logger"] = logger
            level = get_path(self.event, "level", filter=True)
            if level:
                log_info["level"] = level
            if log_info:
                self._log_info = [log_info]
            else:
                self._log_info = []
        return self._log_info

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
                        "abs_path": frame.get("abs_path") or frame.get("filename"),
                        "filename": frame.get("filename"),
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
                    thread = get_crashing_thread(threads)
                    if thread is not None:
                        frames = get_path(thread, "stacktrace", "frames")
                for frame in frames or ():
                    _push_frame(frame)

        return self._frames

    def get_toplevel(self):
        if self._toplevel is None:
            self._toplevel = self.get_messages() + self.get_exceptions()
        return self._toplevel

    def get_tags(self):
        if self._tags is None:
            self._tags = [
                {"tags.%s" % k: v for (k, v) in get_path(self.event, "tags", filter=True) or ()}
            ]
        return self._tags

    def get_values(self, match_group):
        return getattr(self, "get_" + match_group)()


class FingerprintingRules:
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
                return (rule,) + new_values

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
                f'Invalid syntax near "{context}" (line {e.line()}, column {e.column()})'
            )
        return FingerprintingVisitor().visit(tree)


MATCHERS = {
    # discover field names
    "error.type": "type",
    "error.value": "value",
    "stack.module": "module",
    "stack.abs_path": "path",
    "stack.package": "package",
    "stack.function": "function",
    "message": "message",
    "logger": "logger",
    "level": "level",
    # fingerprinting shortened fields
    "type": "type",
    "value": "value",
    "module": "module",
    "path": "path",
    "package": "package",
    "function": "function",
    # fingerprinting specific fields
    "family": "family",
    "app": "app",
}


class Match:
    def __init__(self, key, pattern, negated=False):
        if key.startswith("tags."):
            self.key = key
        else:
            try:
                self.key = MATCHERS[key]
            except KeyError:
                raise InvalidFingerprintingConfig("Unknown matcher '%s'" % key)
        self.pattern = pattern
        self.negated = negated

    @property
    def match_group(self):
        if self.key == "message":
            return "toplevel"
        if self.key in ("logger", "level"):
            return "log_info"
        if self.key in ("type", "value"):
            return "exceptions"
        if self.key.startswith("tags."):
            return "tags"
        return "frames"

    def matches(self, values):
        rv = self._positive_match(values)
        if self.negated:
            rv = not rv
        return rv

    def _positive_path_match(self, value):
        if value is None:
            return False
        if glob_match(value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True):
            return True
        if not value.startswith("/") and glob_match(
            "/" + value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True
        ):
            return True
        return False

    def _positive_match(self, values):
        # path is special in that it tests against two values (abs_path and path)
        if self.key == "path":
            value = values.get("abs_path")
            if self._positive_path_match(value):
                return True
            alt_value = values.get("filename")
            if alt_value != value:
                if self._positive_path_match(value):
                    return True
            return False

        # message tests against value as well as this is what users expect
        if self.key == "message":
            for key in ("message", "value"):
                value = values.get(key)
                if value is not None and glob_match(value, self.pattern, ignorecase=True):
                    return True
            return False

        value = values.get(self.key)
        if value is None:
            return False
        elif self.key == "package":
            if self._positive_path_match(value):
                return True
        elif self.key == "family":
            flags = self.pattern.split(",")
            if "all" in flags or value in flags:
                return True
        elif self.key == "app":
            ref_val = get_rule_bool(self.pattern)
            if ref_val is not None and ref_val == value:
                return True
        elif glob_match(value, self.pattern, ignorecase=self.key in ("level", "value")):
            return True
        return False

    def _to_config_structure(self):
        key = self.key
        if self.negated:
            key = "!" + key
        return [key, self.pattern]

    @classmethod
    def _from_config_structure(cls, obj):
        key = obj[0]
        if key.startswith("!"):
            key = key[1:]
            negated = True
        else:
            negated = False
        return cls(key, obj[1], negated)

    @property
    def text(self):
        return '{}{}:"{}"'.format(
            self.negated and "!" or "",
            self.key,
            self.pattern,
        )


class Rule:
    def __init__(self, matchers, fingerprint, attributes):
        self.matchers = matchers
        self.fingerprint = fingerprint
        self.attributes = attributes

    def get_fingerprint_values_for_event_access(self, access):
        by_match_group = {}
        for matcher in self.matchers:
            by_match_group.setdefault(matcher.match_group, []).append(matcher)

        for match_group, matchers in by_match_group.items():
            for values in access.get_values(match_group):
                if all(x.matches(values) for x in matchers):
                    break
            else:
                return

        return self.fingerprint, self.attributes

    def _to_config_structure(self):
        return {
            "matchers": [x._to_config_structure() for x in self.matchers],
            "fingerprint": self.fingerprint,
            "attributes": self.attributes,
        }

    @classmethod
    def _from_config_structure(cls, obj):
        return cls(
            [Match._from_config_structure(x) for x in obj["matchers"]],
            obj["fingerprint"],
            obj.get("attributes") or {},
        )

    def to_json(self):
        return self._to_config_structure()

    @classmethod
    def from_json(cls, json):
        return cls._from_config_structure(json)

    @property
    def text(self):
        return (
            '%s -> "%s" %s'
            % (
                " ".join(x.text for x in self.matchers),
                "".join(x for x in self.fingerprint),
                " ".join(f'{k}="{v}"' for (k, v) in sorted(self.attributes.items())),
            )
        ).rstrip()


class FingerprintingVisitor(NodeVisitor):
    visit_comment = visit_empty = lambda *a: None
    unwrapped_exceptions = (InvalidFingerprintingConfig,)

    def visit_comment(self, node, children):
        return node.text

    def visit_fingerprinting_rules(self, node, children):
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
        return FingerprintingRules(rules, inspect.cleandoc("\n".join(changelog)).rstrip() or None)

    def visit_line(self, node, children):
        _, line, _ = children
        comment_or_rule_or_empty = line[0]
        if comment_or_rule_or_empty:
            return comment_or_rule_or_empty

    def visit_rule(self, node, children):
        _, matcher, _, _, _, (fingerprint, attributes) = children
        return Rule(matcher, fingerprint, attributes)

    def visit_matcher(self, node, children):
        _, negation, ty, _, argument = children
        return Match(ty, argument, bool(negation))

    def visit_matcher_type(self, node, children):
        return children[0]

    def visit_argument(self, node, children):
        return children[0]

    visit_fp_argument = visit_argument

    def visit_fingerprint(self, node, children):
        fingerprint = []
        attributes = {}
        for item in children:
            if isinstance(item, tuple):
                key, value = item
                attributes[key] = value
            else:
                fingerprint.append(item)
        return fingerprint, attributes

    def visit_fp_value(self, node, children):
        _, argument, _, _ = children
        return argument

    def visit_fp_attribute(self, node, children):
        key, _, value = children
        if key != "title":
            raise InvalidFingerprintingConfig("Unknown attribute '%s'" % key)
        return (key, value)

    def visit_quoted(self, node, children):
        return unescape_string(node.text[1:-1])

    def visit_unquoted(self, node, children):
        return node.text

    visit_unquoted_no_comma = visit_unquoted

    def generic_visit(self, node, children):
        return children

    def visit_key(self, node, children):
        return node.text

    def visit_quoted_key(self, node, children):
        # leading ! are used to indicate negation. make sure they don't appear.
        return node.match.groups()[0].lstrip("!")
