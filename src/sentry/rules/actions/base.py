"""
sentry.rules.actions.base
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

from sentry.rules.base import RuleBase


class EventAction(RuleBase):
    rule_type = 'action/event'

    def after(self, event, state):
        pass
