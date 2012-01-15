"""
sentry
~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

try:
    VERSION = __import__('pkg_resources') \
        .get_distribution('sentry').version
except Exception, e:
    VERSION = 'unknown'

# We store global interpreter state in here
environment = {}
