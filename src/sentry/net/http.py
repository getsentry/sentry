from __future__ import absolute_import

from socket import error as SocketError, timeout as SocketTimeout

from requests import Session as _Session
from requests.adapters import HTTPAdapter, DEFAULT_POOLBLOCK
from urllib3.connectionpool import HTTPConnectionPool, HTTPSConnectionPool
from urllib3.connection import HTTPConnection, HTTPSConnection
from urllib3.exceptions import NewConnectionError, ConnectTimeoutError
from urllib3.poolmanager import PoolManager

from sentry import VERSION as SENTRY_VERSION
from sentry.net.socket import safe_create_connection


class SafeConnectionMixin(object):
    """
    HACK(mattrobenolt): Most of this is yanked out of core urllib3
    to override `_new_conn` with the ability to create our own socket.
    """

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
        return self._dns_host.rstrip('.')

    @host.setter
    def host(self, value):
        """
        Setter for the `host` property.
        We assume that only urllib3 uses the _dns_host attribute; httplib itself
        only uses `host`, and it seems reasonable that other libraries follow suit.
        """
        self._dns_host = value

    # Mostly yanked from https://github.com/urllib3/urllib3/blob/1.22/urllib3/connection.py#L127
    def _new_conn(self):
        """ Establish a socket connection and set nodelay settings on it.
        :return: New socket connection.
        """
        extra_kw = {}
        if self.source_address:
            extra_kw['source_address'] = self.source_address

        if self.socket_options:
            extra_kw['socket_options'] = self.socket_options

        try:
            # HACK(mattrobenolt): All of this is to replace this one line
            # to establish our own connection.
            conn = safe_create_connection(
                (self._dns_host, self.port), self.timeout, **extra_kw)

        except SocketTimeout as e:
            raise ConnectTimeoutError(
                self, "Connection to %s timed out. (connect timeout=%s)" %
                (self.host, self.timeout))

        except SocketError as e:
            raise NewConnectionError(
                self, "Failed to establish a new connection: %s" % e)

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
            'http': SafeHTTPConnectionPool,
            'https': SafeHTTPSConnectionPool,
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
            num_pools=connections,
            maxsize=maxsize,
            block=block,
            strict=True,
            **pool_kwargs)


USER_AGENT = u'sentry/{version} (https://sentry.io)'.format(
    version=SENTRY_VERSION,
)


class Session(_Session):
    def request(self, *args, **kwargs):
        kwargs.setdefault('timeout', 30)
        response = _Session.request(self, *args, **kwargs)
        # requests' attempts to use chardet internally when no encoding is found
        # and we want to avoid that slow behavior
        if not response.encoding:
            response.encoding = 'utf-8'
        return response


class SafeSession(Session):
    def __init__(self):
        Session.__init__(self)
        self.headers.update({'User-Agent': USER_AGENT})
        adapter = BlacklistAdapter()
        self.mount('https://', adapter)
        self.mount('http://', adapter)
