"""
sentry.options.defaults
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function


from sentry.options import register, FLAG_NOSTORE, FLAG_REQUIRED, FLAG_PRIORITIZE_DISK
from sentry.options.types import Dict


register('cache.backend', flags=FLAG_NOSTORE)
register('cache.options', type=Dict, flags=FLAG_NOSTORE)
register('system.admin-email', flags=FLAG_REQUIRED)
register('system.databases', type=Dict, flags=FLAG_NOSTORE)
register('system.debug', default=False, flags=FLAG_NOSTORE)
register('system.rate-limit', default=0, flags=FLAG_PRIORITIZE_DISK)
register('system.secret-key', flags=FLAG_NOSTORE)
register('redis.options', type=Dict, flags=FLAG_NOSTORE)

# Absolute URL to the sentry root directory. Should not include a trailing slash.
register('system.url-prefix', ttl=60, grace=3600, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
