"""
sentry.services.udp
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import logging

from sentry.services.base import Service

logger = logging.getLogger(__file__)


class CommandError(Exception):
    pass


class SentryUDPServer(Service):
    name = 'udp'

    def __init__(self, host=None, port=None, debug=False):
        from sentry.conf import settings

        self.debug = debug

        self.host = host or settings.UDP_HOST
        self.port = port or settings.UDP_PORT

    def handle(self, data, address):
        from sentry.exceptions import InvalidData
        from sentry.coreapi import project_from_auth_vars, decode_and_decompress_data, safely_load_json_string, \
          validate_data, insert_data_to_database, APIError
        from sentry.utils.auth import parse_auth_header

        try:
            try:
                auth_header, data = data.split("\n\n", 1)
            except ValueError:
                raise APIError("missing auth header")

            auth_vars = parse_auth_header(auth_header)
            project = project_from_auth_vars(auth_vars, data)

            client = auth_vars.get('sentry_client')

            if not data.startswith('{'):
                data = decode_and_decompress_data(data)
            data = safely_load_json_string(data)

            try:
                validate_data(project, data, client)
            except InvalidData, e:
                raise APIError(unicode(e))

            return insert_data_to_database(data)
        except APIError, error:
            logger.error('bad message from %s: %s' % (address, error.msg))
            return error

    def run(self):
        try:
            import eventlet
        except ImportError:
            raise CommandError('It seems that you don\'t have the ``eventlet`` package installed, which is required to run '
                               'the udp service.')

        from eventlet.green import socket

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((self.host, self.port))
        pool = eventlet.GreenPool()
        while True:
            try:
                pool.spawn_n(self.handle, *sock.recvfrom(2**16))
            except (SystemExit, KeyboardInterrupt):
                break
