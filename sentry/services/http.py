"""
sentry.services.http
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import eventlet

from eventlet import wsgi, patcher

from sentry.services.base import Service


class SentryHTTPServer(Service):
    name = 'http'

    def __init__(self, host=None, port=None, debug=False):
        from sentry.conf import settings

        self.debug = debug

        self.host = host or settings.WEB_HOST
        self.port = port or settings.WEB_PORT

    def run(self):
        from sentry.wsgi import application

        def inner_run():
            # Install eventlet patches after everything else has been run,
            # and inside our server thread
            patcher.monkey_patch()

            wsgi.server(eventlet.listen((self.host, self.port)), application)

        if self.debug:
            from django.utils import autoreload
            autoreload.main(inner_run)
        else:
            inner_run()
