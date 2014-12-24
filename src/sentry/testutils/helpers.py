"""
sentry.testutils.helpers
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import


def get_auth_header(client, api_key=None, secret_key=None):
    header = [
        ('sentry_client', client),
        ('sentry_version', '5'),
    ]

    if api_key:
        header.append(('sentry_key', api_key))
    if secret_key:
        header.append(('sentry_secret', secret_key))

    return 'Sentry %s' % ', '.join('%s=%s' % (k, v) for k, v in header)
