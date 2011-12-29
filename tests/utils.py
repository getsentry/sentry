from __future__ import with_statement
import socket
import threading
import warnings

from django.conf import settings as django_settings
from django.core.handlers.wsgi import WSGIHandler
from django.core.management import call_command
from django.core.servers import basehttp

from sentry.conf import settings
from sentry.utils.compat.db import connections

class StoppableWSGIServer(basehttp.WSGIServer):
    """WSGIServer with short timeout, so that server thread can stop this server."""

    def server_bind(self):
        """Sets timeout to 1 second."""
        basehttp.WSGIServer.server_bind(self)
        self.socket.settimeout(1)

    def get_request(self):
        """Checks for timeout when getting request."""
        try:
            sock, address = self.socket.accept()
            sock.settimeout(None)
            return (sock, address)
        except socket.timeout:
            raise

class TestServerThread(threading.Thread):
    """Thread for running a http server while tests are running."""

    def __init__(self, test, address, port):
        self.test = test
        self.address = address
        self.port = port
        self._stopevent = threading.Event()
        self.started = threading.Event()
        self.error = None
        super(TestServerThread, self).__init__()

    def run(self):
        """Sets up test server and database and loops over handling http requests."""
        try:
            handler = basehttp.AdminMediaHandler(WSGIHandler())
            server_address = (self.address, self.port)
            httpd = StoppableWSGIServer(server_address, basehttp.WSGIRequestHandler)
            httpd.set_app(handler)
            self.started.set()
        except basehttp.WSGIServerException, e:
            self.error = e
            self.started.set()
            return

        # Must do database stuff in this new thread if database in memory.
        conn_settings = connections['default'].settings_dict
        if conn_settings['ENGINE'] == 'sqlite3' \
            and (not conn_settings['TEST_NAME'] or conn_settings['TEST_NAME'] == ':memory:'):
            # Import the fixture data into the test database.
            if hasattr(self.test, 'fixtures'):
                # We have to use this slightly awkward syntax due to the fact
                # that we're using *args and **kwargs together.
                call_command('loaddata', *self.test.fixtures, **{'verbosity': 0})

        # Loop until we get a stop event.
        while not self._stopevent.isSet():
            httpd.handle_request()

    def join(self, timeout=None):
        """Stop the thread and wait for it to finish."""
        self._stopevent.set()
        threading.Thread.join(self, timeout)

def conditional_on_module(module):
    def wrapped(func):
        def inner(self, *args, **kwargs):
            try:
                __import__(module)
            except ImportError:
                warnings.warn("Skipping test: %s.%s" % (self.__class__.__name__, func.__name__), ImportWarning)
                return lambda x, *a, **kw: None
            else:
                return func(self, *args, **kwargs)
        return inner
    return wrapped

class Settings(object):
    """
    Allows you to define settings that are required for this function to work.

    >>> with Settings(SENTRY_LOGIN_URL='foo'): #doctest: +SKIP
    >>>     print settings.SENTRY_LOGIN_URL #doctest: +SKIP
    """

    NotDefined = object()

    def __init__(self, **overrides):
        self.overrides = overrides
        self._orig = {}
        self._orig_sentry = {}

    def __enter__(self):
        for k, v in self.overrides.iteritems():
            self._orig[k] = getattr(django_settings, k, self.NotDefined)
            setattr(django_settings, k, v)
            if k.startswith('SENTRY_'):
                nk = k.split('SENTRY_', 1)[1]
                self._orig_sentry[nk] = getattr(settings, nk, self.NotDefined)
                setattr(settings, nk, v)

    def __exit__(self, exc_type, exc_value, traceback):
        for k, v in self._orig.iteritems():
            if v is self.NotDefined:
                delattr(django_settings, k)
            else:
                setattr(django_settings, k, v)
        for k, v in self._orig_sentry.iteritems():
            if v is self.NotDefined:
                delattr(settings, k)
            else:
                setattr(settings, k, v)
