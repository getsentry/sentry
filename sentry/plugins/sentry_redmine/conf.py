"""
sentry.plugins.sentry_redmine.conf
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf import settings

# Either API_KEY or USERNAME/PASSWORD should be specified for non-anonymous
# XXX: In redmine as of Oct 15 2010 API KEY auth does not support creating issues

REDMINE_API_KEY = getattr(settings, 'SENTRY_REDMINE_API_KEY', None)
REDMINE_URL = getattr(settings, 'SENTRY_REDMINE_URL', None)
REDMINE_PROJECT_SLUG = getattr(settings, 'SENTRY_REDMINE_PROJECT_SLUG', None)

REDMINE_USERNAME = getattr(settings, 'SENTRY_REDMINE_USERNAME', None)
REDMINE_PASSWORD = getattr(settings, 'SENTRY_REDMINE_PASSWORd', None)
