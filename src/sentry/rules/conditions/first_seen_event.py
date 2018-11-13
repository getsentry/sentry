"""
sentry.rules.conditions.first_seen_event
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.rules.conditions.base import EventCondition


class FirstSeenEventCondition(EventCondition):
    label = 'An issue is first seen'

    def passes(self, event, state):
        if self.rule.environment_id is None:
            return state.is_new
        else:
            return state.is_new_group_environment
