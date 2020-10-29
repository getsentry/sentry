from __future__ import absolute_import

from collections import namedtuple
from parsimonious.grammar import Grammar, NodeVisitor
from parsimonious.exceptions import ParseError  # noqa
from sentry.utils.safe import get_path
from sentry.utils.glob import glob_match

__all__ = ("parse_rules", "dump_schema", "load_schema")

VERSION = 1

# Grammar is defined in EBNF syntax.
ownership_grammar = Grammar(
    r"""

ownership = line+

line = _ (comment / rule / empty) newline?

rule = _ matcher owners

matcher      = _ matcher_tag any_identifier
matcher_tag  = (matcher_type sep)?
matcher_type = "url" / "path" / event_tag

event_tag   = ~r"tags.[^:]+"

owners       = _ owner+
owner        = _ team_prefix identifier
team_prefix  = "#"?

comment = ~r"#[^\r\n]*"

# TODO: make more specific
any_identifier = quoted_identifier / identifier
identifier = ~r"\S+"
quoted_identifier = ~r'"([^"\\]*(?:\\.[^"\\]*)*)"'

sep     = ":"
space   = " "
empty   = ""
newline = ~r"[\r\n]"
_       = space*

"""
)


class Rule(namedtuple("Rule", "matcher owners")):
    """
    A Rule represents a single line in an Ownership file.
    This line contains a Matcher and a list of Owners.
    """

    def dump(self):
        return {"matcher": self.matcher.dump(), "owners": [o.dump() for o in self.owners]}

    @classmethod
    def load(cls, data):
        return cls(Matcher.load(data["matcher"]), [Owner.load(o) for o in data["owners"]])

    def test(self, data):
        return self.matcher.test(data)


class Matcher(namedtuple("Matcher", "type pattern")):
    """
    A Matcher represents a type:pattern pairing for use in
    comparing with an Event.

    type is either `path` or `url` at this point.

    TODO(mattrobenolt): pattern needs to be parsed into a regex

    Examples:
        url:example.com
        path:src/*
        src/*
    """

    def dump(self):
        return {"type": self.type, "pattern": self.pattern}

    @classmethod
    def load(cls, data):
        return cls(data["type"], data["pattern"])

    def test(self, data):
        if self.type == "url":
            return self.test_url(data)
        elif self.type == "path":
            return self.test_path(data)
        elif self.type.startswith("tags."):
            return self.test_tag(data)
        return False

    def test_url(self, data):
        try:
            url = data["request"]["url"]
        except KeyError:
            return False
        return url and glob_match(url, self.pattern, ignorecase=True)

    def test_path(self, data):
        for frame in _iter_frames(data):
            filename = frame.get("filename") or frame.get("abs_path")

            if not filename:
                continue

            if glob_match(filename, self.pattern, ignorecase=True, path_normalize=True):
                return True

        return False

    def test_tag(self, data):
        tag = self.type[5:]
        for k, v in get_path(data, "tags", filter=True) or ():
            if k == tag and glob_match(v, self.pattern):
                return True
        return False


class Owner(namedtuple("Owner", "type identifier")):
    """
    An Owner represents a User or Team who owns this Rule.

    type is either `user` or `team`.

    Examples:
        foo@example.com
        #team
    """

    def dump(self):
        return {"type": self.type, "identifier": self.identifier}

    @classmethod
    def load(cls, data):
        return cls(data["type"], data["identifier"])


class OwnershipVisitor(NodeVisitor):
    visit_comment = visit_empty = lambda *a: None

    def visit_ownership(self, node, children):
        return [_f for _f in children if _f]

    def visit_line(self, node, children):
        _, line, _ = children
        comment_or_rule_or_empty = line[0]
        if comment_or_rule_or_empty:
            return comment_or_rule_or_empty

    def visit_rule(self, node, children):
        _, matcher, owners = children
        return Rule(matcher, owners)

    def visit_matcher(self, node, children):
        _, tag, identifier = children
        return Matcher(tag, identifier)

    def visit_matcher_tag(self, node, children):
        if not children:
            return "path"
        (tag,) = children
        type, _ = tag
        return type[0].text

    def visit_owners(self, node, children):
        _, owners = children
        return owners

    def visit_owner(self, node, children):
        _, is_team, pattern = children
        type = "team" if is_team else "user"
        # User emails are case insensitive, so coerce them
        # to lowercase, so they can be de-duped, etc.
        if type == "user":
            pattern = pattern.lower()
        return Owner(type, pattern)

    def visit_team_prefix(self, node, children):
        return bool(children)

    def visit_any_identifier(self, node, children):
        return children[0]

    def visit_identifier(self, node, children):
        return node.text

    def visit_quoted_identifier(self, node, children):
        return node.text[1:-1].encode("ascii", "backslashreplace").decode("unicode-escape")

    def generic_visit(self, node, children):
        return children or node


def _iter_frames(data):
    try:
        for frame in get_path(data, "stacktrace", "frames", filter=True) or ():
            yield frame
    except KeyError:
        pass

    try:
        values = get_path(data, "exception", "values", filter=True) or ()
    except KeyError:
        return

    for value in values:
        try:
            for frame in get_path(value, "stacktrace", "frames", filter=True) or ():
                yield frame
        except KeyError:
            continue


def parse_rules(data):
    """Convert a raw text input into a Rule tree"""
    tree = ownership_grammar.parse(data)
    return OwnershipVisitor().visit(tree)


def dump_schema(rules):
    """Convert a Rule tree into a JSON schema"""
    return {"$version": VERSION, "rules": [r.dump() for r in rules]}


def load_schema(schema):
    """Convert a JSON schema into a Rule tree"""
    if schema["$version"] != VERSION:
        raise RuntimeError("Invalid schema $version: %r" % schema["$version"])
    return [Rule.load(r) for r in schema["rules"]]
