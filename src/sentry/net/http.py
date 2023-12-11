from __future__ import annotations

import socket
from functools import partial
from socket import error as SocketError
from socket import timeout as SocketTimeout
from typing import Callable, Optional

from requests import Session as _Session
from requests.adapters import DEFAULT_POOLBLOCK, HTTPAdapter
from urllib3.connection import HTTPConnection, HTTPSConnection
from urllib3.connectionpool import HTTPConnectionPool, HTTPSConnectionPool
from urllib3.connectionpool import connection_from_url as _connection_from_url
from urllib3.exceptions import ConnectTimeoutError, NewConnectionError
from urllib3.poolmanager import PoolManager
from urllib3.util.connection import _set_socket_options

from sentry import VERSION as SENTRY_VERSION
from sentry.net.socket import safe_create_connection

IsIpAddressPermitted = Optional[Callable[[str], bool]]


class SafeConnectionMixin:
    """
    HACK(mattrobenolt): Most of this is yanked out of core urllib3
    to override `_new_conn` with the ability to create our own socket.
    """

    is_ipaddress_permitted: IsIpAddressPermitted = None

    def __init__(self, *args, is_ipaddress_permitted: IsIpAddressPermitted = None, **kwargs):
        self.is_ipaddress_permitted = is_ipaddress_permitted
        super().__init__(*args, **kwargs)

    # urllib3.connection.HTTPConnection.host
    # These `host` properties need rebound otherwise `self._dns_host` doesn't
    # get set correctly.
    @property
    def host(self):
        """
        Getter method to remove any trailing dots that indicate the hostname is an FQDN.
        In general, SSL certificates don't include the trailing dot indicating a
        fully-qualified domain name, and thus, they don't validate properly when
        checked against a domain name that includes the dot. In addition, some
        servers may not expect to receive the trailing dot when provided.
        However, the hostname with trailing dot is critical to DNS resolution; doing a
        lookup with the trailing dot will properly only resolve the appropriate FQDN,
        whereas a lookup without a trailing dot will search the system's search domain
        list. Thus, it's important to keep the original host around for use only in
        those cases where it's appropriate (i.e., when doing DNS lookup to establish the
        actual TCP connection across which we're going to send HTTP requests).
        """
        return self._dns_host.rstrip(".")

    @host.setter
    def host(self, value):
        """
        Setter for the `host` property.
        We assume that only urllib3 uses the _dns_host attribute; httplib itself
        only uses `host`, and it seems reasonable that other libraries follow suit.
        """
        self._dns_host = value

    # urllib3.connection.HTTPConnection._new_conn
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
            # Begin custom code.
            conn = safe_create_connection(
                (self._dns_host, self.port),
                self.timeout,
                is_ipaddress_permitted=self.is_ipaddress_permitted,
                **extra_kw,
            )
            # End custom code.

        except SocketTimeout:
            raise ConnectTimeoutError(
                self,
                f"Connection to {self.host} timed out. (connect timeout={self.timeout})",
            )

        except SocketError as e:
            raise NewConnectionError(self, f"Failed to establish a new connection: {e}")

        return conn


class SafeHTTPConnection(SafeConnectionMixin, HTTPConnection):
    pass


class SafeHTTPSConnection(SafeConnectionMixin, HTTPSConnection):
    pass


class InjectIPAddressMixin:
    def __init__(self, *args, is_ipaddress_permitted: IsIpAddressPermitted = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.ConnectionCls = partial(
            self.ConnectionCls, is_ipaddress_permitted=is_ipaddress_permitted
        )


class SafeHTTPConnectionPool(InjectIPAddressMixin, HTTPConnectionPool):
    ConnectionCls = SafeHTTPConnection


class SafeHTTPSConnectionPool(InjectIPAddressMixin, HTTPSConnectionPool):
    ConnectionCls = SafeHTTPSConnection


class SafePoolManager(PoolManager):
    """
    This custom PoolManager is needed to override
    pool_classes_by_scheme which allows us to set which
    ConnectionPool classes to create.
    """

    def __init__(self, *args, is_ipaddress_permitted: IsIpAddressPermitted = None, **kwargs):
        PoolManager.__init__(self, *args, **kwargs)
        self.pool_classes_by_scheme = {
            "http": partial(SafeHTTPConnectionPool, is_ipaddress_permitted=is_ipaddress_permitted),
            "https": partial(
                SafeHTTPSConnectionPool, is_ipaddress_permitted=is_ipaddress_permitted
            ),
        }


class BlacklistAdapter(HTTPAdapter):
    """
    We need a custom HTTPAdapter to initialize our custom SafePoolManager
    rather than the default PoolManager.
    """

    is_ipaddress_permitted: IsIpAddressPermitted = None

    def __init__(self, is_ipaddress_permitted: IsIpAddressPermitted = None) -> None:
        # If is_ipaddress_permitted is defined, then we pass it as an additional parameter to freshly created
        # `urllib3.connectionpool.ConnectionPool` instances managed by `SafePoolManager`.
        self.is_ipaddress_permitted = is_ipaddress_permitted
        super().__init__()

    def init_poolmanager(self, connections, maxsize, block=DEFAULT_POOLBLOCK, **pool_kwargs):
        self._pool_connections = connections
        self._pool_maxsize = maxsize
        self._pool_block = block
        # Begin custom code.
        self.poolmanager = SafePoolManager(
            num_pools=connections,
            maxsize=maxsize,
            block=block,
            strict=True,
            is_ipaddress_permitted=self.is_ipaddress_permitted,
            **pool_kwargs,
        )
        # End custom code.


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
        if not response.encoding:
            response.encoding = "utf-8"
        return response


class SafeSession(Session):
    def __init__(self, is_ipaddress_permitted: IsIpAddressPermitted = None) -> None:
        Session.__init__(self)
        self.headers.update({"User-Agent": USER_AGENT})
        adapter = BlacklistAdapter(is_ipaddress_permitted=is_ipaddress_permitted)
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
