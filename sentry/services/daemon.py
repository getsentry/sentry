"""
sentry.servers.daemon
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from daemon.daemon import DaemonContext
from daemon.runner import is_pidfile_stale, DaemonRunnerStartFailureError, \
  emit_message, DaemonRunnerStopFailureError, make_pidlockfile
import lockfile
import os
import signal
import sys


class Daemon(object):
    """
    Controller for a callable running in a separate background process.
    """

    start_message = u"{1} started with pid {0}"

    def __init__(self, app, pidfile=None, stdout=sys.stdout, stderr=sys.stderr, **options):
        """
        Set up the parameters of a new runner.

        The `app` argument must have the following attributes:

        * `run`: Callable that will be invoked when the daemon is
          started.
        """
        self.app = app
        if pidfile:
            self.pidfile = make_pidlockfile(pidfile, 5)
        else:
            self.pidfile = None

        self.daemon_context = DaemonContext(
            stdout=stdout,
            stderr=stderr,
            pidfile=self.pidfile,
            **options
        )

    def start(self):
        """
        Open the daemon context and run the application.
        """
        if self.pidfile and is_pidfile_stale(self.pidfile):
            self.pidfile.break_lock()

        try:
            self.daemon_context.open()
        except lockfile.AlreadyLocked:
            raise DaemonRunnerStartFailureError(
                u"PID file %(pidfile_path)r already locked".format(
                  self.pidfile.path))

        pid = os.getpid()
        message = self.start_message.format(pid, self.app.name)

        emit_message(message)
        signal.signal(signal.SIGHUP, self.restart)

        self.app.run()

    def stop(self):
        """
        Exit the daemon process specified in the current PID file.
        """
        if not self.pidfile:
            self.daemon_context.close()

        if not self.pidfile.is_locked():
            raise DaemonRunnerStopFailureError(
                u"PID file {0} not locked".format(self.pidfile.path))

        if is_pidfile_stale(self.pidfile):
            self.pidfile.break_lock()
        else:
            self._terminate_daemon_process()

    def restart(self, *args):
        """
        Stop, then start.
        """
        self.stop()
        self.start()

    def _terminate_daemon_process(self):
        """
        Terminate the daemon process specified in the current PID file.
        """

        pid = self.pidfile.read_pid()
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError, exc:
            raise DaemonRunnerStopFailureError(
                u"Failed to terminate {0}: {1}".format(pid, exc))

