"""
sentry.nodestore.riak.client
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import functools
import six
import sys
import socket
from base64 import b64encode
from random import shuffle
from six.moves.queue import Queue
from time import time
from threading import Lock, Thread, Event

# utilize the ca_certs path from requests since we already depend on it
# and they bundle a ca cert.
from requests.certs import where as ca_certs
from six.moves.urllib.parse import urlencode, quote_plus
from urllib3 import HTTPConnectionPool, HTTPSConnectionPool
from urllib3.exceptions import HTTPError

from sentry.net.http import UnixHTTPConnectionPool


DEFAULT_NODES = ({'host': '127.0.0.1', 'port': 8098}, )


def encode_basic_auth(auth):
    auth = ':'.join(auth)
    return 'Basic ' + b64encode(auth).decode('utf-8')


class SimpleThreadedWorkerPool(object):
    """\
    Manages a simple threaded worker pool. The pool will be started when the
    first job is submitted, and will run to process completion.
    """

    def __init__(self, size):
        assert size > 0, 'pool must have at laest one worker thread'

        self.__started = False
        self.__size = size

    def __start(self):
        self.__tasks = tasks = Queue()

        def consumer():
            while True:
                func, args, kwargs, cb = tasks.get()
                try:
                    rv = func(*args, **kwargs)
                except Exception as e:
                    rv = e
                finally:
                    cb(rv)
                    tasks.task_done()

        for _ in range(self.__size):
            t = Thread(target=consumer)
            t.setDaemon(True)
            t.start()

        self.__started = True

    def submit(self, func_arg_kwargs_cb):
        """\
        Submit a task to the worker pool.
        """
        if not self.__started:
            self.__start()

        self.__tasks.put(func_arg_kwargs_cb)


class RiakClient(object):
    """
    A thread-safe simple light-weight riak client that does only
    the bare minimum.
    """

    def __init__(self, multiget_pool_size=5, **kwargs):
        self.manager = ConnectionManager(**kwargs)
        self.pool = SimpleThreadedWorkerPool(multiget_pool_size)

    def build_url(self, bucket, key, qs):
        url = '/buckets/%s/keys/%s' % tuple(map(quote_plus, (bucket, key)))
        if qs:
            url += '?' + urlencode(qs)
        return url

    def put(self, bucket, key, data, headers=None, **kwargs):
        if headers is None:
            headers = {}
        headers['content-type'] = 'application/json'

        return self.manager.urlopen(
            'PUT',
            self.build_url(bucket, key, kwargs),
            headers=headers,
            body=data,
        )

    def delete(self, bucket, key, headers=None, **kwargs):
        return self.manager.urlopen(
            'DELETE',
            self.build_url(bucket, key, kwargs),
            headers=headers,
        )

    def get(self, bucket, key, headers=None, **kwargs):
        if headers is None:
            headers = {}
        headers['accept-encoding'] = 'gzip'  # urllib3 will automatically decompress

        return self.manager.urlopen(
            'GET',
            self.build_url(bucket, key, kwargs),
            headers=headers,
        )

    def multiget(self, bucket, keys, headers=None, **kwargs):
        """
        Thread-safe multiget implementation that shares the same thread pool
        for all requests.
        """
        # Each request is paired with a thread.Event to signal when it is finished
        requests = [(key, self.build_url(bucket, key, kwargs), Event()) for key in keys]

        results = {}

        def callback(key, event, rv):
            results[key] = rv
            # Signal that this request is finished
            event.set()

        for key, url, event in requests:
            self.pool.submit(
                (
                    self.manager.urlopen,  # func
                    ('GET', url),  # args
                    {
                        'headers': headers
                    },  # kwargs
                    functools.partial(
                        callback,
                        key,
                        event,
                    ),  # callback
                )
            )

        # Now we wait for all of the callbacks to be finished
        for _, _, event in requests:
            event.wait()

        return results

    def close(self):
        self.manager.close()


class RoundRobinStrategy(object):
    def __init__(self):
        self.i = -1

    def next(self, connections):
        self.i += 1
        return connections[self.i % len(connections)]


class FirstStrategy(object):
    def next(self, connections):
        return connections[0]


class ConnectionManager(object):
    """
    A thread-safe multi-host http connection manager.
    """

    def __init__(
        self,
        hosts=DEFAULT_NODES,
        strategy=RoundRobinStrategy,
        randomize=True,
        timeout=3,
        cooldown=5,
        max_retries=None,
        tcp_keepalive=True
    ):
        assert hosts
        self.dead_connections = []
        self.timeout = timeout
        self.cooldown = cooldown
        self.tcp_keepalive = tcp_keepalive

        # Default max_retries to number of hosts
        if max_retries is None:
            self.max_retries = len(hosts)
        else:
            self.max_retries = max_retries

        self.connections = map(self.create_pool, hosts)
        # Shuffle up the order to prevent stampeding the same hosts
        if randomize:
            shuffle(self.connections)

        # If we have a single connection, we can short-circuit some logic
        self.single_connection = len(hosts) == 1

        # If we only have one connection, let's override and use a more optimized
        # strategy
        if self.single_connection:
            strategy = FirstStrategy

        self.strategy = strategy()

        # Lock needed when mutating the alive/dead list of connections
        self._lock = Lock()

    def create_pool(self, host):
        """
        Create a new HTTP(S)ConnectionPool for a (host, port) tuple
        """
        options = {
            'timeout': self.timeout,
            'strict': True,
            'retries': host.get('retries', 2),
            # Max of 5 connections open per host
            # this is arbitrary. The # of connections can burst
            # above 5 if needed becuase we're also setting
            # block=False
            'maxsize': host.get('maxsize', 5),
            'block': False,
            'headers': host.get('headers', {})
        }

        if 'basic_auth' in host:
            options['headers']['authorization'] = encode_basic_auth(host['basic_auth'])

        # Support backwards compatibility with `http_port`
        if 'http_port' in host:
            import warnings
            warnings.warn("'http_port' has been deprecated. Use 'port'.", DeprecationWarning)
            host['port'] = host.pop('http_port')

        addr = host.get('host', '127.0.0.1')
        port = int(host.get('port', 8098))
        secure = host.get('secure', False)
        if addr[:1] == '/':
            pool_cls = UnixHTTPConnectionPool
        elif not secure:
            pool_cls = HTTPConnectionPool
        else:
            pool_cls = HTTPSConnectionPool
            verify_ssl = host.get('verify_ssl', False)
            if verify_ssl:
                options.extend(
                    {
                        'cert_reqs': host.get('cert_reqs', 'CERT_REQUIRED'),
                        'ca_certs': host.get('ca_certs', ca_certs())
                    }
                )

        if self.tcp_keepalive:
            options['socket_options'] = pool_cls.ConnectionCls.default_socket_options + [
                (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1),
            ]

        return pool_cls(addr, port, **options)

    def urlopen(self, method, path, headers=None, **kwargs):
        """
        Make a request using the next server according to the connection
        strategy, and retries up to max_retries attempts. Ultimately,
        if the request still failed, we reraise the HTTPError from
        urllib3. If at the start of the request, there are no known
        available hosts, we revive all dead connections and forcefully
        attempt to reconnect.
        """

        # We don't need strict host checking since our client is enforcing
        # the correct behavior anyways
        kwargs.setdefault('assert_same_host', False)

        # Keep track of the last exception, so we can raise it if needed
        last_error = None

        try:
            for _ in range(self.max_retries + 1):
                # If we're trying to initiate a new connection, and
                # all connections are already dead, then we should flail
                # and attempt to connect to one of them
                if len(self.connections) == 0:
                    self.force_revive()

                conn = self.strategy.next(self.connections)  # NOQA
                if headers is not None:
                    headers = dict(conn.headers, **headers)
                try:
                    return conn.urlopen(method, path, headers=headers, **kwargs)
                except HTTPError:
                    self.mark_dead(conn)
                    last_error = sys.exc_info()

            # We've exhausted the retries, and we still have
            # all errors, so re-raise the last known error
            if last_error is not None:
                six.reraise(*last_error)
        finally:
            self.cleanup_dead()

    def mark_dead(self, conn):
        """
        Mark a connection as dead.
        """

        # If we are operating with only a single connection,
        # it's futile to mark the connection as dead since it'll
        # just flap between active and dead with no value. In the
        # event of one connection, we just want to keep retrying
        # in hopes that it'll eventually work.
        if self.single_connection:
            return

        timeout = time() + self.cooldown
        with self._lock:
            self.dead_connections.append((conn, timeout))
            self.connections.remove(conn)

    def force_revive(self):
        """
        Forcefully revive all dead connections
        """
        with self._lock:
            for conn, _ in self.dead_connections:
                self.connections.append(conn)
            self.dead_connections = []

    def cleanup_dead(self):
        """
        Check dead connections and see if any timeouts have expired
        """
        if not self.dead_connections:
            return

        now = time()
        for conn, timeout in self.dead_connections[:]:
            if timeout > now:
                # Can exit fast here on the first non-expired
                # since dead_connections is ordered
                return

            # timeout has expired, so move from dead to alive pool
            with self._lock:
                try:
                    # Attempt to remove the connection from dead_connections
                    # pool, but it's possible that it was already removed in
                    # another thread.
                    self.dead_connections.remove((conn, timeout))
                except ValueError:
                    # In which case, we don't care and we just carry on.
                    pass
                else:
                    # Only add the connection back into the live pool
                    # if we've successfully removed from dead pool.
                    self.connections.append(conn)

    def close(self):
        """
        Close all connections to all servers
        """
        self.force_revive()

        for conn in self.connections:
            conn.close()
