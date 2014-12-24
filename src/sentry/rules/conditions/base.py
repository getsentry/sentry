"""
sentry.rules.conditions.base
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from sentry.rules.base import RuleBase


class EventCondition(RuleBase):
    rule_type = 'condition/event'

    def passes(self, event, state):
        raise NotImplementedError
