"""
sentry.plugins.base.structs
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

__all__ = ('Annotation', 'Notification')

import warnings


class Annotation(object):
    def __init__(self, label, url=None, description=None):
        self.label = label
        self.url = url
        self.description = description


class Notification(object):
    def __init__(self, event, rule=None, rules=None):
        if rule and not rules:
            rules = [rule]

        self.event = event
        self.rules = rules or []

    @property
    def rule(self):
        warnings.warn('Notification.rule is deprecated. Switch to Notification.rules.',
                      DeprecationWarning)
        return self.rules[0]
