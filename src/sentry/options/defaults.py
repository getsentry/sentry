"""
sentry.options.defaults
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from sentry.options import (
    FLAG_IMMUTABLE, FLAG_NOSTORE, FLAG_PRIORITIZE_DISK, FLAG_REQUIRED, FLAG_ALLOW_EMPTY,
    register,
)
from sentry.utils.types import Dict, String

# Cache
# register('cache.backend', flags=FLAG_NOSTORE)
# register('cache.options', type=Dict, flags=FLAG_NOSTORE)

# System
register('system.admin-email', flags=FLAG_REQUIRED)
register('system.databases', type=Dict, flags=FLAG_NOSTORE)
# register('system.debug', default=False, flags=FLAG_NOSTORE)
register('system.rate-limit', default=0, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('system.secret-key', flags=FLAG_NOSTORE)
# Absolute URL to the sentry root directory. Should not include a trailing slash.
register('system.url-prefix', ttl=60, grace=3600, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register('system.root-api-key', flags=FLAG_PRIORITIZE_DISK)

# Redis
register(
    'redis.clusters',
    type=Dict,
    default={
        'default': {
            'hosts': {
                0: {
                    'host': '127.0.0.1',
                    'port': 6379,
                }
            },
        },
    },
    flags=FLAG_NOSTORE | FLAG_IMMUTABLE
)
register('redis.options', type=Dict, flags=FLAG_NOSTORE)

# symbolizer specifics
register('dsym.llvm-symbolizer-path', type=String)
register('dsym.cache-path', type=String, default='/tmp/sentry-dsym-cache')

# Mail
register('mail.backend', default='smtp', flags=FLAG_NOSTORE)
register('mail.host', default='localhost', flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register('mail.port', default=25, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register('mail.username', flags=FLAG_REQUIRED | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('mail.password', flags=FLAG_REQUIRED | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('mail.use-tls', default=False, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register('mail.subject-prefix', default='[Sentry] ', flags=FLAG_PRIORITIZE_DISK)
register('mail.from', default='root@localhost', flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register('mail.list-namespace', type=String, default='localhost', flags=FLAG_NOSTORE)
register('mail.enable-replies', default=False, flags=FLAG_PRIORITIZE_DISK)
register('mail.reply-hostname', default='', flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('mail.mailgun-api-key', default='', flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
