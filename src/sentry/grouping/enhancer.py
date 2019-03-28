from __future__ import absolute_import

import os
import six
import base64
import msgpack
import inspect

from parsimonious.grammar import Grammar, NodeVisitor
from parsimonious.exceptions import ParseError

from sentry.utils.compat import implements_to_string


# Grammar is defined in EBNF syntax.
enhancements_grammar = Grammar(r"""

enhancements = line+

line = _ (comment / rule / empty) newline?

rule = _ matchers actions

matchers       = matcher+
matcher        = _ matcher_type sep argument
matcher_type   = "path" / "function" / "module"

actions        = action+
action         = _ range? flag action_name
action_name    = "keep" / "group" / "app"
flag           = "+" / "-"
range          = "^" / "v"

comment        = ~r"#[^\r\n]*"

argument       = quoted / unquoted
quoted         = ~r'"([^"\\]*(?:\\.[^"\\]*)*)"'
unquoted       = ~r"\S+"

sep     = ":"
space   = " "
empty   = ""
newline = ~r"[\r\n]"
_       = space*

""")


VERSION = 1
MATCH_KEYS = {
    'path': 'p',
    'function': 'f',
    'module': 'm',
}
SHORT_MATCH_KEYS = dict((v, k) for k, v in six.iteritems(MATCH_KEYS))

ACTIONS = ['keep', 'group', 'app']
ACTION_FLAGS = {
    (True, None): 0,
    (True, 'up'): 1,
    (True, 'down'): 2,
    (False, None): 3,
    (False, 'up'): 4,
    (False, 'down'): 5,
}
REVERSE_ACTION_FLAGS = dict((v, k) for k, v in six.iteritems(ACTION_FLAGS))


class InvalidEnhancerConfig(Exception):
    pass


class Match(object):

    def __init__(self, key, pattern):
        self.key = key
        self.pattern = pattern

    def _to_config_structure(self):
        return MATCH_KEYS[self.key] + self.pattern

    @classmethod
    def _from_config_structure(cls, obj):
        return cls(SHORT_MATCH_KEYS[obj[0]], obj[1:])


@implements_to_string
class Action(object):

    def __init__(self, key, flag, range):
        self.key = key
        self.flag = flag
        self.range = range

    def __str__(self):
        return '%s%s%s' % (
            {'up': '^', 'down': 'v'}.get(self.range, ''),
            self.flag and '+' or '-',
            self.key,
        )

    def _to_config_structure(self):
        return ACTIONS.index(self.key) | (ACTION_FLAGS[self.flag, self.range] << 5)

    @classmethod
    def _from_config_structure(cls, num):
        flag, range = REVERSE_ACTION_FLAGS[num >> 5]
        return cls(ACTIONS[num & 0xf], flag, range)


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

    def as_dict(self, with_rules=False):
        rv = {
            'id': self.id,
            'changelog': self.changelog,
            'bases': self.bases,
        }
        if with_rules:
            rv['rules'] = [x.as_dict() for x in self.rules]
        return rv

    def _to_config_structure(self):
        return [self.version, self.bases, [x._to_config_structure() for x in self.rules]]

    def dumps(self):
        return base64.urlsafe_b64encode(msgpack.dumps(
            self._to_config_structure()).encode('zlib')).strip('=')

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
        return cls([Rule._from_config_structure(x) for x in rules], version, bases)

    @classmethod
    def loads(cls, data):
        padded = data + b'=' * (4 - (len(data) % 4))
        try:
            return cls._from_config_structure(msgpack.loads(
                base64.urlsafe_b64decode(padded).decode('zlib')))
        except (LookupError, AttributeError, TypeError, ValueError) as e:
            raise ValueError('invalid grouping enhancement config: %s' % e)

    @classmethod
    def from_config_string(self, s, bases=None, id=None):
        try:
            tree = enhancements_grammar.parse(s)
        except ParseError as e:
            context = e.text[e.pos:e.pos + 33]
            if len(context) == 33:
                context = context[:-1] + '...'
            raise InvalidEnhancerConfig('Invalid syntax near "%s" (line %s, column %s)' % (
                context, e.line(), e.column(),
            ))
        return EnhancmentsVisitor(bases, id).visit(tree)


class Rule(object):

    def __init__(self, matchers, actions):
        self.matchers = matchers
        self.actions = actions

    def as_dict(self):
        matchers = {}
        for matcher in self.matchers:
            matchers[matcher.key] = matcher.pattern
        return {
            'match': matchers,
            'actions': [six.text_type(x) for x in self.actions],
        }

    def _to_config_structure(self):
        return [
            [x._to_config_structure() for x in self.matchers],
            [x._to_config_structure() for x in self.actions],
        ]

    @classmethod
    def _from_config_structure(cls, tuple):
        return Rule([Match._from_config_structure(x) for x in tuple[0]],
                    [Action._from_config_structure(x) for x in tuple[1]])


class EnhancmentsVisitor(NodeVisitor):
    visit_comment = visit_empty = lambda *a: None

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
                if in_header and child[:2] == '##':
                    changelog.append(child[2:].rstrip())
                else:
                    in_header = False
            elif child is not None:
                rules.append(child)
                in_header = False
        return Enhancements(
            rules,
            inspect.cleandoc('\n'.join(changelog)).rstrip() or None,
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
        _, ty, _, argument = children
        return Match(ty, argument)

    def visit_matcher_type(self, node, children):
        return node.text

    def visit_argument(self, node, children):
        return children[0]

    def visit_action(self, node, children):
        _, rng, flag, action_name = children
        return Action(action_name, flag, rng[0] if rng else None)

    def visit_action_name(self, node, children):
        return node.text

    def visit_flag(self, node, children):
        return node.text == '+'

    def visit_range(self, node, children):
        if node.text == '^':
            return 'up'
        return 'down'

    def visit_quoted(self, node, children):
        return node.text[1:-1] \
            .encode('ascii', 'backslashreplace') \
            .decode('unicode-escape')

    def visit_unquoted(self, node, children):
        return node.text

    def visit_identifier(self, node, children):
        return node.text

    def generic_visit(self, node, children):
        return children


def _load_configs():
    rv = {}
    base = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'enhancement-configs')
    for fn in os.listdir(base):
        if fn.endswith('.txt'):
            with open(os.path.join(base, fn)) as f:
                rv[fn[:-4]] = Enhancements.from_config_string(f.read().decode('utf-8'), id=fn[:-4])
    return rv


ENHANCEMENT_BASES = _load_configs()
LATEST_ENHANCEMENT_BASE = sorted(x for x in ENHANCEMENT_BASES
                                 if x.startswith('common:'))[-1]
DEFAULT_ENHANCEMENTS_CONFIG = Enhancements(rules=[], bases=[LATEST_ENHANCEMENT_BASE]).dumps()
del _load_configs
