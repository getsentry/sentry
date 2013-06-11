"""
sentry.utils.avatar
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import hashlib
import urllib


def get_gravatar_url(email, size=None, default='mm'):
    base = 'https://secure.gravatar.com'

    gravatar_url = "%s/avatar/%s" % (base, hashlib.md5(email.lower()).hexdigest())

    properties = {}
    if size:
        properties['s'] = str(size)
    if default:
        properties['d'] = default
    if properties:
        gravatar_url += "?" + urllib.urlencode(properties)

    return gravatar_url
