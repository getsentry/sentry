"""
sentry.services.http
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import sys
import gunicorn

from gunicorn import arbiter
from gunicorn.app import djangoapp
import gunicorn.util

from sentry.services.base import Service


def _setup_app(app):
    djangoapp.make_default_env(app.cfg)
    djwsgi = gunicorn.util.import_module("gunicorn.app.django_wsgi")
    djwsgi.make_wsgi_application()


class SentryApplication(djangoapp.DjangoApplication):

    def __init__(self, options):
        self.usage = None
        self.cfg = None
        self.config_file = options.get("config") or ""
        self.options = options
        self.callable = None
        self.project_path = None

        self.do_load_config()

        for k, v in self.options.items():
            if k.lower() in self.cfg.settings and v is not None:
                self.cfg.set(k.lower(), v)

    def init(self, parser, opts, args):
        pass

    def load(self):
        # application should be imported at first to setup env
        from sentry.wsgi import application
        _setup_app(self)
        return application


class SentryHTTPServer(Service):
    name = 'http'

    def __init__(self, host=None, port=None, debug=False, workers=None):
        from sentry.conf import settings

        self.host = host or settings.WEB_HOST
        self.port = port or settings.WEB_PORT
        self.workers = workers

        # import cProfile, os

        # def post_fork(server, worker):
        #     orig_init_process_ = worker.init_process

        #     def profiling_init_process(self):
        #         orig_init_process = orig_init_process_
        #         ofile = '/tmp/.profile%s' % (os.getpid(),)
        #         print 'Profiling worker %s, output file: %s' % (worker, ofile)
        #         cProfile.runctx('orig_init_process()', globals(), locals(), ofile)
        #     worker.init_process = profiling_init_process.__get__(worker)

        options = (settings.WEB_OPTIONS or {}).copy()
        options['bind'] = '%s:%s' % (self.host, self.port)
        options['debug'] = debug
        options['daemon'] = False
        options.setdefault('timeout', 30)
        if workers:
            options['workers'] = workers

        self.app = SentryApplication(options)

    def run(self):
        try:
            arbiter.Arbiter(self.app).run()
        except RuntimeError, e:
            sys.stderr.write("\nError: %s\n\n" % e)
            sys.stderr.flush()
            sys.exit(1)
