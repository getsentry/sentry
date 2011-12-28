"""
sentry.utils.server
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import eventlet
import os
import os.path

from daemon.daemon import DaemonContext
from daemon.runner import DaemonRunner, make_pidlockfile
from eventlet import wsgi, patcher


class SentryServer(DaemonRunner):
    pidfile_timeout = 10
    start_message = u"started with pid %(pid)d"

    def __init__(self, host=None, port=None, pidfile=None,
                 logfile=None, daemonize=False, debug=False):
        from sentry.conf import settings

        if not logfile:
            logfile = settings.WEB_LOG_FILE

        logfile = os.path.realpath(logfile)
        pidfile = os.path.realpath(pidfile or settings.WEB_PID_FILE)

        if daemonize:
            detach_process = True
        else:
            detach_process = False

        self.daemon_context = DaemonContext(detach_process=detach_process)
        self.daemon_context.stdout = open(logfile, 'w+')
        self.daemon_context.stderr = open(logfile, 'w+', buffering=0)

        self.debug = debug
        self.pidfile = make_pidlockfile(pidfile, self.pidfile_timeout)

        self.daemon_context.pidfile = self.pidfile

        self.host = host or settings.WEB_HOST
        self.port = port or settings.WEB_PORT

        # HACK: set app to self so self.app.run() works
        self.app = self

    def execute(self, action):
        self.action = action

        if self.daemon_context.detach_process is False and self.action == 'start':
            # HACK:
            self.run()
        else:
            self.do_action()

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
