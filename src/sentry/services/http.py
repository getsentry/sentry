"""
sentry.services.http
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.core.management import call_command

from sentry.services.base import Service


class SentryHTTPServer(Service):
    name = 'http'

    def __init__(self, host=None, port=None, debug=False, workers=None,
                 validate=True):
        from django.conf import settings

        if validate:
            self.validate_settings()

        self.host = host or settings.SENTRY_WEB_HOST
        self.port = port or settings.SENTRY_WEB_PORT
        self.workers = workers

        options = (settings.SENTRY_WEB_OPTIONS or {}).copy()
        options['debug'] = debug
        options.setdefault('bind', '%s:%s' % (self.host, self.port))
        options.setdefault('daemon', False)
        options.setdefault('timeout', 30)
        options.setdefault('proc_name', 'Sentry')
        if workers:
            options['workers'] = workers

        self.options = options

    def validate_settings(self):
        from django.conf import settings as django_settings
        from sentry.utils.settings import validate_settings

        validate_settings(django_settings)

    def run(self):
        call_command('run_gunicorn', **self.options)
