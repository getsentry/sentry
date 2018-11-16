"""
sentry.utils.javascript
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import


from sentry.utils.meta import get_all_valid


def has_sourcemap(event):
    if event.platform not in ('javascript', 'node'):
        return False

    for exception, meta in get_all_valid(event.data, 'exception', 'values', with_meta=True) or ():
        for frame in get_all_valid(exception, 'stacktrace', 'frames', meta=meta) or ():
            if 'sourcemap' in (frame.get('data') or {}):
                return True

    return False
