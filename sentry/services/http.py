"""
sentry.services.http
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from gunicorn.app.djangoapp import DjangoApplication
from gunicorn.arbiter import Arbiter
import sys

from sentry.services.base import Service


class SentryApplication(DjangoApplication):
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
        from sentry.wsgi import application
        import eventlet.patcher

        eventlet.patcher.monkey_patch()

        self.validate()
        self.activate_translation()

        return application


class SentryHTTPServer(Service):
    name = 'http'

    def __init__(self, host=None, port=None, debug=False):
        from sentry.conf import settings

        self.host = host or settings.WEB_HOST
        self.port = port or settings.WEB_PORT

        # import cProfile, os

        # def post_fork(server, worker):
        #     orig_init_process_ = worker.init_process

        #     def profiling_init_process(self):
        #         orig_init_process = orig_init_process_
        #         ofile = '/tmp/.profile%s' % (os.getpid(),)
        #         print 'Profiling worker %s, output file: %s' % (worker, ofile)
        #         cProfile.runctx('orig_init_process()', globals(), locals(), ofile)
        #     worker.init_process = profiling_init_process.__get__(worker)

        options = {
            'bind': '%s:%s' % (self.host, self.port),
            'worker_class': 'eventlet',
            'debug': debug,
            'daemon': False,
            # 'post_fork': post_fork,
        }
        options.update(settings.WEB_OPTIONS or {})

        self.app = SentryApplication(options)

    def run(self):
        try:
            Arbiter(self.app).run()
        except RuntimeError, e:
            sys.stderr.write("\nError: %s\n\n" % e)
            sys.stderr.flush()
            sys.exit(1)
