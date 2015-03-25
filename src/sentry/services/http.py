"""
sentry.services.http
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from gunicorn.app.base import Application

from sentry.services.base import Service


class SentryGunicornCommand(Application):
    def __init__(self, options):
        self.usage = None
        self.prog = None
        self.cfg = None
        self.config_file = ""
        self.options = options
        self.callable = None
        self.project_path = None
        self.do_load_config()

    def init(self, *args):
        cfg = {}
        for k, v in self.options.items():
            if k.lower() in self.cfg.settings and v is not None:
                cfg[k.lower()] = v
        return cfg

    def load(self):
        import sentry.wsgi
        return sentry.wsgi.application


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
        options.setdefault('bind', '%s:%s' % (self.host, self.port))
        options.setdefault('timeout', 30)
        options.setdefault('proc_name', 'Sentry')
        options.setdefault('workers', 3)
        options.setdefault('access_logfile', '-')
        options.setdefault('errorlog', '-')
        options.setdefault('loglevel', 'info')
        options.setdefault('limit_request_line', 0)
        options['preload'] = False

        if workers:
            options['workers'] = workers

        self.options = options

    def validate_settings(self):
        from django.conf import settings as django_settings
        from sentry.utils.settings import validate_settings

        validate_settings(django_settings)

    def run(self):
        SentryGunicornCommand(self.options).run()
