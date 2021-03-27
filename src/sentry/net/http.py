import socket
from socket import error as SocketError, timeout as SocketTimeout

from requests import Session as _Session
from requests.adapters import HTTPAdapter, DEFAULT_POOLBLOCK
from urllib3.connectionpool import (
    HTTPConnectionPool,
    HTTPSConnectionPool,
    connection_from_url as _connection_from_url,
)
from urllib3.connection import HTTPConnection, HTTPSConnection
from urllib3.exceptions import NewConnectionError, ConnectTimeoutError
from urllib3.poolmanager import PoolManager
from urllib3.util.connection import _set_socket_options

from sentry import VERSION as SENTRY_VERSION
from sentry.net.socket import safe_create_connection


class SafeConnectionMixin:
    # https://github.com/urllib3/urllib3/blob/1.25.11/src/urllib3/connection.py#L146
    def _new_conn(self):
        """Establish a socket connection and set nodelay settings on it.
        :return: New socket connection.
        """
        extra_kw = {}
        if self.source_address:
            extra_kw["source_address"] = self.source_address

        if self.socket_options:
            extra_kw["socket_options"] = self.socket_options

        try:
            # Begin divergent code.
            conn = safe_create_connection((self._dns_host, self.port), self.timeout, **extra_kw)
            # End divergent code.
        except SocketTimeout:
            raise ConnectTimeoutError(
                self,
                f"Connection to {self.host} timed out. (connect timeout={self.timeout})",
            )

        except SocketError as e:
            raise NewConnectionError(self, "Failed to establish a new connection: %s" % e)

        return conn


class SafeHTTPConnection(SafeConnectionMixin, HTTPConnection):
    pass


class SafeHTTPSConnection(SafeConnectionMixin, HTTPSConnection):
    pass


class SafeHTTPConnectionPool(HTTPConnectionPool):
    ConnectionCls = SafeHTTPConnection


class SafeHTTPSConnectionPool(HTTPSConnectionPool):
    ConnectionCls = SafeHTTPSConnection


class SafePoolManager(PoolManager):
    """
    This custom PoolManager is needed to override
    pool_classes_by_scheme which allows us to set which
    ConnectionPool classes to create.
    """

    def __init__(self, *args, **kwargs):
        PoolManager.__init__(self, *args, **kwargs)
        self.pool_classes_by_scheme = {
            "http": SafeHTTPConnectionPool,
            "https": SafeHTTPSConnectionPool,
        }


class BlacklistAdapter(HTTPAdapter):
    """
    We need a custom HTTPAdapter to initialize our custom SafePoolManager
    rather than the default PoolManager.
    """

    def init_poolmanager(self, connections, maxsize, block=DEFAULT_POOLBLOCK, **pool_kwargs):
        self._pool_connections = connections
        self._pool_maxsize = maxsize
        self._pool_block = block
        self.poolmanager = SafePoolManager(
            num_pools=connections, maxsize=maxsize, block=block, strict=True, **pool_kwargs
        )


class TimeoutAdapter(HTTPAdapter):
    def __init__(self, *args, **kwargs):
        timeout = kwargs.pop("timeout", None)
        HTTPAdapter.__init__(self, *args, **kwargs)
        if timeout is None:
            timeout = 10.0
        self.default_timeout = timeout

    def send(self, *args, **kwargs):
        if kwargs.get("timeout") is None:
            kwargs["timeout"] = self.default_timeout
        return HTTPAdapter.send(self, *args, **kwargs)


USER_AGENT = f"sentry/{SENTRY_VERSION} (https://sentry.io)"


class Session(_Session):
    def request(self, *args, **kwargs):
        kwargs.setdefault("timeout", 30)
        response = _Session.request(self, *args, **kwargs)
        # requests' attempts to use chardet internally when no encoding is found
        # and we want to avoid that slow behavior
        # TODO(joshuarli): investigate
        if not response.encoding:
            response.encoding = "utf-8"
        return response


class SafeSession(Session):
    def __init__(self):
        Session.__init__(self)
        self.headers.update({"User-Agent": USER_AGENT})
        adapter = BlacklistAdapter()
        self.mount("https://", adapter)
        self.mount("http://", adapter)


class UnixHTTPConnection(HTTPConnection):
    default_socket_options = []

    def __init__(self, host, **kwargs):
        # We're using the `host` as the socket path, but
        # urllib3 uses this host as the Host header by default.
        # If we send along the socket path as a Host header, this is
        # never what you want and would typically be malformed value.
        # So we fake this by sending along `localhost` by default as
        # other libraries do.
        self.socket_path = host
        super().__init__(host="localhost", **kwargs)

    def _new_conn(self):
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)

        # If provided, set socket level options before connecting.
        _set_socket_options(sock, self.socket_options)

        if self.timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:
            sock.settimeout(self.timeout)
        sock.connect(self.socket_path)
        return sock


class UnixHTTPConnectionPool(HTTPConnectionPool):
    ConnectionCls = UnixHTTPConnection

    def __str__(self):
        return f"{type(self).__name__}(host={self.host!r})"


def connection_from_url(endpoint, **kw):
    if endpoint[:1] == "/":
        return UnixHTTPConnectionPool(endpoint, **kw)
    return _connection_from_url(endpoint, **kw)
