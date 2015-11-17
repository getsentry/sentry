"""
sentry.nodestore.riak.client
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import socket
from random import shuffle
from time import time
from threading import Lock, Thread, Event
from Queue import Queue

# utilize the ca_certs path from requests since we already depend on it
# and they bundle a ca cert.
from requests.certs import where as ca_certs
from urllib import urlencode, quote_plus
from urllib3 import HTTPConnectionPool, HTTPSConnectionPool
from urllib3.connection import HTTPConnection
from urllib3.exceptions import HTTPError


DEFAULT_NODES = (
    {'host': '127.0.0.1', 'port': 8098},
)


class RiakClient(object):
    """
    A thread-safe simple light-weight riak client that does only
    the bare minimum.
    """
    def __init__(self, multiget_pool_size=5, **kwargs):
        self.manager = ConnectionManager(**kwargs)
        self.queue = Queue()

        # TODO: maybe start this lazily? Probably not valuable though
        # since we definitely will need it.
        self._start(multiget_pool_size)

    def _start(self, size):
        assert size > 0
        for _ in xrange(size):
            t = Thread(target=self._target)
            t.setDaemon(True)
            t.start()

    def _target(self):
        q = self.queue
        while True:
            func, args, kwargs, cb = q.get()
            try:
                rv = func(*args, **kwargs)
            except Exception as e:
                rv = e
            finally:
                cb(rv)
                q.task_done()

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
            'PUT', self.build_url(bucket, key, kwargs),
            headers=headers,
            body=data,
        )

    def delete(self, bucket, key, headers=None, **kwargs):
        return self.manager.urlopen(
            'DELETE', self.build_url(bucket, key, kwargs),
            headers=headers,
        )

    def get(self, bucket, key, headers=None, **kwargs):
        return self.manager.urlopen(
            'GET', self.build_url(bucket, key, kwargs),
            headers=headers,
        )

    def multiget(self, bucket, keys, headers=None, **kwargs):
        """
        Thread-safe multiget implementation that shares the same thread pool
        for all requests.
        """
        # Each request is paired with a thread.Event to signal when it is finished
        requests = [
            (key, self.build_url(bucket, key, {'foo': 'bar'}), Event())
            for key in keys
        ]

        results = {}
        for key, url, event in requests:
            def callback(rv, key=key, event=event):
                results[key] = rv
                # Signal that this request is finished
                event.set()

            self.queue.put((
                self.manager.urlopen,  # func
                ('GET', url),  # args
                {'headers': headers},  # kwargs
                callback,  # callback
            ))

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


class ConnectionManager(object):
    """
    A thread-safe multi-host http connection manager.
    """
    def __init__(self, hosts=DEFAULT_NODES, strategy=RoundRobinStrategy, randomize=True,
                 timeout=3, cooldown=5, max_retries=3, tcp_keepalive=True):
        assert hosts
        self.strategy = strategy()
        self.dead_connections = []
        self.timeout = timeout
        self.cooldown = cooldown
        self.max_retries = max_retries
        self.tcp_keepalive = tcp_keepalive

        self.connections = map(self.create_pool, hosts)
        # Shuffle up the order to prevent stampeding the same hosts
        if randomize:
            shuffle(self.connections)

        # Lock needed when mutating the alive/dead list of connections
        self._lock = Lock()

    def create_pool(self, host):
        """
        Create a new HTTP(S)ConnectionPool for a (host, port) tuple
        """
        options = {
            'timeout': self.timeout,
            'strict': True,
            # We don't need urllib3's retries, since we'll retry
            # on a different host ourselves
            'retries': False,
            # Max of 5 connections open per host
            # this is arbitrary. The # of connections can burst
            # above 5 if needed becuase we're also setting
            # block=False
            'maxsize': 5,
            'block': False,
        }
        if self.tcp_keepalive:
            options['socket_options'] = HTTPConnection.default_socket_options + [
                (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1),
            ]

        # Support backwards compatibility with `http_port`
        if 'http_port' in host:
            import warnings
            warnings.warn("'http_port' has been deprecated. Use 'port'.",
                          DeprecationWarning)
            host['port'] = host.pop('http_port')

        addr = host.get('host', '127.0.0.1')
        port = int(host.get('port', 8098))
        secure = host.get('secure', False)
        if not secure:
            connection_cls = HTTPConnectionPool
        else:
            connection_cls = HTTPSConnectionPool
            verify_ssl = host.get('verify_ssl', False)
            if verify_ssl:
                options.extend({
                    'cert_reqs': host.get('cert_reqs', 'CERT_REQUIRED'),
                    'ca_certs': host.get('ca_certs', ca_certs())
                })
        return connection_cls(addr, port, **options)

    def urlopen(self, method, path, **kwargs):
        """
        Make a request using the next server according to the connection
        strategy, and retries up to max_retries attempts. Ultimately,
        if the request still failed, we reraise the HTTPError from
        urllib3. If at the start of the request, there are no known
        available hosts, we revive all dead connections and forcefully
        attempt to reconnect.
        """
        # If we're trying to initiate a new connection, and
        # all connections are already dead, then we should flail
        # and attempt to connect to one of them
        if len(self.connections) == 0:
            self.force_revive()

        # We don't need strict host checking since our client is enforcing
        # the correct behavior anyways
        kwargs.setdefault('assert_same_host', False)

        try:
            for _ in xrange(self.max_retries):
                conn = self.strategy.next(self.connections)
                try:
                    return conn.urlopen(method, path, **kwargs)
                except HTTPError:
                    self.mark_dead(conn)

                    if len(self.connections) == 0:
                        raise
        finally:
            self.cleanup_dead()

    def mark_dead(self, conn):
        """
        Mark a connection as dead.
        """
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
                self.connections.append(conn)
                self.dead_connections.remove((conn, timeout))

    def close(self):
        """
        Close all connections to all servers
        """
        self.force_revive()

        for conn in self.connections:
            conn.close()
