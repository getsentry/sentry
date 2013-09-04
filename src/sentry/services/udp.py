"""
sentry.services.udp
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import socket
import logging

from sentry.services.base import Service

logger = logging.getLogger(__file__)


class CommandError(Exception):
    pass


def handle_sentry(data, address):
    from sentry.coreapi import (project_from_auth_vars, decode_and_decompress_data,
        safely_load_json_string, validate_data, insert_data_to_database, APIError,
        APIForbidden)
    from sentry.models import Group
    from sentry.exceptions import InvalidData
    from sentry.plugins import plugins
    from sentry.utils.auth import parse_auth_header

    try:
        try:
            auth_header, data = data.split('\n\n', 1)
        except ValueError:
            raise APIError('missing auth header')

        try:
            auth_vars = parse_auth_header(auth_header)
        except (ValueError, IndexError):
            raise APIError('invalid auth header')

        project, user = project_from_auth_vars(auth_vars)

        result = plugins.first('has_perm', user, 'create_event', project)
        if result is False:
            raise APIForbidden('Creation of this event was blocked')

        client = auth_vars.get('sentry_client')

        if not data.startswith('{'):
            data = decode_and_decompress_data(data)
        data = safely_load_json_string(data)

        try:
            validate_data(project, data, client)
        except InvalidData, e:
            raise APIError(u'Invalid data: %s (%s)' % (unicode(e), type(e)))

        Group.objects.normalize_event_data(data)

        return insert_data_to_database(data)
    except APIError, error:
        logger.exception('bad message from %s' % (address,))
        return error


class BaseUDPServer(Service):

    BUF_SIZE = 2 ** 16
    POOL_SIZE = 1000

    _socket = None
    _spawn = None

    def __init__(self, host=None, port=None, debug=False, workers=None):
        super(BaseUDPServer, self).__init__(debug=debug)
        from django.conf import settings

        self.host = host or settings.SENTRY_UDP_HOST
        self.port = port or settings.SENTRY_UDP_PORT
        self.workers = workers or self.POOL_SIZE

    def setup(self):
        assert self._socket and self._spawn, \
            'Base class cannot be used to run the udp service.'

    def handle(self, data, address):
        return handle_sentry(data, address)

    def run(self):
        try:
            self.setup()
        except ImportError:
            raise CommandError(
                'It seems that you don\'t have the ``%s`` package installed, '
                'which is required to run the udp service.' % (self.name,))
        try:
            sock = self._socket(socket.AF_INET6, socket.SOCK_DGRAM)
            sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((self.host.strip('[]'), self.port))
        except (socket.gaierror, socket.error):
            sock = self._socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((self.host, self.port))
        while True:
            try:
                self._spawn(self.handle, *sock.recvfrom(self.BUF_SIZE))
            except (SystemExit, KeyboardInterrupt):
                break


class EventletUDPServer(BaseUDPServer):

    name = 'eventlet'

    def setup(self):
        import eventlet
        from eventlet.green import socket
        self._socket = socket.socket
        self._pool = eventlet.GreenPool(size=self.workers)
        self._spawn = self._pool.spawn_n


class GeventUDPServer(BaseUDPServer):

    name = 'gevent'

    def setup(self):
        from gevent import socket, pool
        self._socket = socket.socket
        self._pool = pool.Pool(size=self.workers)
        self._spawn = self._pool.spawn


default_servers = {
    'gevent': GeventUDPServer,
    'eventlet': EventletUDPServer,
}


def get_server_class(worker=None):
    from django.conf import settings

    if worker is None:
        # Use eventlet as default worker type
        worker = getattr(settings, 'SENTRY_UDP_WORKER', None) or 'eventlet'
    if worker not in default_servers:
        raise CommandError(
            'Unsupported udp server type; expected one of %s, but got "%s".'
            % (', '.join(default_servers.keys()), worker))

    return default_servers[worker]


class SentryUDPServer(Service):
    '''
    It's factory for sentry udp servers. The factory class used for
    compatibility reason, you should not subclass it. See `get_server_class`
    function for details.
    '''
    def __new__(cls, *args, **kwargs):
        worker = kwargs.pop('worker', None)
        server_cls = get_server_class(worker=worker)
        return server_cls(*args, **kwargs)
