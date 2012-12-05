"""
sentry.services.http
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


from sentry.services.base import Service
from sentry.conf import settings

if settings.WEB_SERVER == 'gunicorn':
    from sentry.webservers import gunicorn_server as webserver
else:
    from sentry.webservers import cherrypy_server as webserver

class SentryHTTPServer(Service):
    name = 'http'

    def __init__(self, host=None, port=None, debug=False, workers=None):

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
        options['host'] = self.host
        options['port'] = self.port
        options['bind'] = '%s:%s' % (self.host, self.port)
        options['debug'] = debug
        options.setdefault('daemon', False)
        options.setdefault('timeout', 30)
        if workers:
            options['workers'] = workers

        self.options = options

    def run(self):
        webserver.run_server(self.options)
