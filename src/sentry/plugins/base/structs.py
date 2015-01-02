"""
sentry.plugins.base.structs
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

__all__ = ('Annotation', 'Notification')


class Annotation(object):
    __slots__ = ['label', 'url', 'description']

    def __init__(self, label, url=None, description=None):
        self.label = label
        self.url = url
        self.description = description


class Notification(object):
    __slots__ = ['event', 'rule']

    def __init__(self, event, rule=None):
        self.event = event
        self.rule = rule
