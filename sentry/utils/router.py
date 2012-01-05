"""
sentry.utils.router
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.conf import settings


class SentryRouter(object):
    def db_for_write(self, model, **hints):
        if model._meta.app_label == 'sentry':
            return settings.DATABASE_USING

    def db_for_read(self, model, **hints):
        return self.db_for_write(model, **hints)

    def allow_syncdb(self, db, model):
        sentry_db = settings.DATABASE_USING
        if not sentry_db:
            return None
        if model._meta.app_label == 'sentry' and db != sentry_db:
            return False
