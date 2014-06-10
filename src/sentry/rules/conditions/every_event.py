"""
sentry.rules.conditions.every_event
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.rules.conditions.base import EventCondition


class EveryEventCondition(EventCondition):
    label = 'An event is seen'

    def passes(self, event, state):
        return True
