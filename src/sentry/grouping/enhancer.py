from __future__ import absolute_import

import os
import six
import base64
import msgpack
import inspect
from itertools import izip

from parsimonious.grammar import Grammar, NodeVisitor
from parsimonious.exceptions import ParseError

from sentry.grouping.utils import get_grouping_family_for_platform
from sentry.utils.compat import implements_to_string
from sentry.utils.glob import glob_match


# Grammar is defined in EBNF syntax.
enhancements_grammar = Grammar(r"""

enhancements = line+

line = _ (comment / rule / empty) newline?

rule = _ matchers actions

matchers       = matcher+
matcher        = _ matcher_type sep argument
matcher_type   = "path" / "function" / "module" / "family" / "package"

actions        = action+
action         = _ range? flag action_name
action_name    = "group" / "app"
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


FAMILIES = {
    'native': 'N',
    'javascript': 'J',
    'all': 'a',
}
REVERSE_FAMILIES = dict((v, k) for k, v in six.iteritems(FAMILIES))

VERSION = 1
MATCH_KEYS = {
    'path': 'p',
    'function': 'f',
    'module': 'm',
    'family': 'F',
    'package': 'P',
}
SHORT_MATCH_KEYS = dict((v, k) for k, v in six.iteritems(MATCH_KEYS))

ACTIONS = ['group', 'app']
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

    def matches_frame(self, frame_data, platform):
        # Path matches are always case insensitive
        if self.key in ('path', 'package'):
            if self.key == 'package':
                value = frame_data.get('package') or ''
            else:
                value = frame_data.get('abs_path') or frame_data.get('filename') or ''
            if glob_match(value, self.pattern, ignorecase=True,
                          doublestar=True, path_normalize=True):
                return True
            if not value.startswith('/') and glob_match('/' + value, self.pattern,
                                                        ignorecase=True, doublestar=True, path_normalize=True):
                return True
            return False

        # families need custom handling as well
        if self.key == 'family':
            flags = self.pattern.split(',')
            if 'all' in flags:
                return True
            family = get_grouping_family_for_platform(frame_data.get('platform') or platform)
            return family in flags

        # all other matches are case sensitive
        if self.key == 'function':
            from sentry.grouping.strategies.utils import trim_function_name
            value = trim_function_name(
                frame_data.get('function') or '<unknown>',
                frame_data.get('platform') or platform)
        elif self.key == 'module':
            value = frame_data.get('module') or '<unknown>'
        else:
            # should not happen :)
            value = '<unknown>'
        return glob_match(value, self.pattern)

    def _to_config_structure(self):
        if self.key == 'family':
            arg = ''.join(filter(None, [FAMILIES.get(x) for x in self.pattern.split(',')]))
        else:
            arg = self.pattern
        return MATCH_KEYS[self.key] + arg

    @classmethod
    def _from_config_structure(cls, obj):
        key = SHORT_MATCH_KEYS[obj[0]]
        if key == 'family':
            arg = ','.join(filter(None, [REVERSE_FAMILIES.get(x) for x in obj[1:]]))
        else:
            arg = obj[1:]
        return cls(key, arg)


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
        return ACTIONS.index(self.key) | (ACTION_FLAGS[self.flag, self.range] << 4)

    def _slice_to_range(self, seq, idx):
        if self.range is None:
            return [seq[idx]]
        elif self.range == 'down':
            return seq[idx + 1:]
        elif self.range == 'up':
            return seq[:idx]
        return []

    def apply_modifications_to_frame(self, frames, idx):
        # Grouping is not stored on the frame
        if self.key == 'group':
            return
        for frame in self._slice_to_range(frames, idx):
            if self.key == 'app':
                frame['in_app'] = self.flag

    def update_frame_components_contributions(self, components, idx):
        for component in self._slice_to_range(components, idx):
            if self.key == 'group' and self.flag != component.contributes:
                component.update(
                    contributes=self.flag,
                    hint='%s by grouping enhancement rule' % (
                        self.flag and 'un-ignored' or 'ignored')
                )
            # The in app flag was set by `apply_modifications_to_frame`
            # but we want to add a hint if there is none yet.
            elif self.key == 'app' and \
                    self.flag == component.contributes and \
                    component.hint is None:
                component.update(
                    hint='marked %s by grouping enhancement rule' % (
                        self.flag and 'in-app' or 'out of app')
                )

    @classmethod
    def _from_config_structure(cls, num):
        flag, range = REVERSE_ACTION_FLAGS[num >> 4]
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
        for rule in self.iter_rules():
            for idx, (component, frame) in enumerate(izip(components, frames)):
                actions = rule.get_matching_frame_actions(frame, platform)
                for action in actions or ():
                    action.update_frame_components_contributions(components, idx)

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
        if version != VERSION:
            raise ValueError('Unknown version')
        return cls(
            rules=[Rule._from_config_structure(x) for x in rules],
            version=version,
            bases=bases
        )

    @classmethod
    def loads(cls, data):
        if six.PY2 and isinstance(data, six.text_type):
            data = data.encode('ascii', 'ignore')
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
DEFAULT_ENHANCEMENT_BASE = 'legacy:2019-03-12'
DEFAULT_ENHANCEMENTS_CONFIG = Enhancements(rules=[], bases=[DEFAULT_ENHANCEMENT_BASE]).dumps()
assert DEFAULT_ENHANCEMENT_BASE in ENHANCEMENT_BASES
del _load_configs
