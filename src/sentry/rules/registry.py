"""
sentry.rules.registry
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from collections import defaultdict


class RuleRegistry(object):
    def __init__(self):
        self._rules = defaultdict(list)
        self._map = {}

    def __contains__(self, rule_id):
        return rule_id in self._map

    def __iter__(self):
        for rule_type, rule_list in self._rules.iteritems():
            for rule in rule_list:
                yield rule_type, rule

    def add(self, rule):
        self._map[rule.id] = rule
        self._rules[rule.rule_type].append(rule)

    def get(self, rule_id, type=None):
        cls = self._map.get(rule_id)
        if type is not None and cls not in self._rules[type]:
            return
        return cls
