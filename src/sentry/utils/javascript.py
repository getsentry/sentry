"""
sentry.utils.javascript
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import


def has_sourcemap(event):
    if event.platform not in ('javascript', 'node'):
        return False
    data = event.data

    if 'sentry.interfaces.Exception' not in data:
        return False
    exception = data['sentry.interfaces.Exception']
    for value in exception['values']:
        stacktrace = value.get('stacktrace', {})
        for frame in stacktrace.get('frames', []):
            if 'sourcemap' in frame.get('data', {}):
                return True

    return False
