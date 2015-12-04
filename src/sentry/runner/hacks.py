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
    def __iter__(self):
        urlbits = urlparse(options.get('system.url-prefix'))
        if urlbits.hostname:
            yield urlbits.hostname
        else:
            yield '*'
