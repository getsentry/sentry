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
        options['debug'] = debug
        options.setdefault('bind', '%s:%s' % (self.host, self.port))
        options.setdefault('daemon', False)
        options.setdefault('timeout', 30)
        options.setdefault('proc_name', 'Sentry')
        if workers:
            options['workers'] = workers

        self.options = options

    def run(self):
        call_command('run_gunicorn', **self.options)
