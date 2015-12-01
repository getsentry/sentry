"""
sentry.options.defaults
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function


from sentry.options import register, FLAG_NOSTORE


register('cache.backend', flags=FLAG_NOSTORE)
register('cache.options', default={}, flags=FLAG_NOSTORE)
register('system.admin-email')
register('system.databases', default={}, flags=FLAG_NOSTORE)
register('system.debug', default=False, flags=FLAG_NOSTORE)
register('system.secret-key', flags=FLAG_NOSTORE)
register('redis.options', default={}, flags=FLAG_NOSTORE)
