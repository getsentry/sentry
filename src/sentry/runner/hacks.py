"""
sentry.runner.hacks
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from urlparse import urlparse
from sentry import options


class AllowedHosts(object):
    # HACK: This is a fake stub for settings.ALLOWED_HOSTS
    # This is needing since ALLOWED_HOSTS is engrained
    # in Django internals, so we want this "tuple" to respond
    # to runtime changes based on our system.url-prefix Option
    def __iter__(self):
        hostname = urlparse(options.get('system.url-prefix')).hostname
        if hostname:
            yield hostname
        else:
            yield '*'
