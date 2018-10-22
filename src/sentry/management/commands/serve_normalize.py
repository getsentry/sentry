"""
sentry.management.commands.serve_normalize
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2018 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import SocketServer
import base64
import os
import stat
import sys
import time
import traceback
import json


from django.core.management.base import BaseCommand, CommandError, make_option


class EventNormalizeHandler(SocketServer.BaseRequestHandler):
    """
    The request handler class for our server.

    It is instantiated once per connection to the server, and must
    override the handle() method to implement communication to the
    client.
    """

    BUFFER_SIZE = 4096

    def handle(self):
        chunks = []

        # Receive the data
        while True:
            rcvd = self.request.recv(self.BUFFER_SIZE)
            if rcvd is None:
                raise ValueError('Received None')

            if not rcvd:
                break
            chunks.append(rcvd)

        self.data = ''.join(chunks)
        sys.stdout.write('> Data received, length: {}\n'.format(len(self.data)))

        response = self.handle_data()
        self.request.sendall(response)
        self.request.close()

    def encode(self, data):
        # Normalized data should be serializable
        return json.dumps(data)

    def decode(self, message):
        meta, data_encoded = json.loads(message)
        data = base64.b64decode(data_encoded)
        return data, meta

    # Here's where the processing happens
    def process_event(self, data, meta):
        from sentry.event_manager import EventManager

        ev = EventManager(
            data,
            client_ip=meta.get('REMOTE_ADDR'),
            user_agent=meta.get('HTTP_USER_AGENT'),
            auth=None,
            key=None,
            content_encoding=meta.get('HTTP_CONTENT_ENCODING')
        )
        ev.normalize()
        return dict(ev.get_data())

    def handle_data(self):
        result = None
        error = None
        start, end = None, None
        try:
            data, meta = self.decode(self.data)
            start = time.time()
            result = self.process_event(data, meta)
            end = time.time()
        except Exception as e:
            error = e.message + ' ' + traceback.format_exc()

        duration = (end - start) if (start and end) else None
        try:
            return self.encode({'result': result, 'error': error, 'duration': duration})
        except (ValueError, TypeError) as e:
            try:
                # Encoding error, try to send the exception instead
                return self.encode({
                    'result': None, 'error': e.message + traceback.format_exc(),
                    'duration': duration, 'encoding_error': True}
                )
            except Exception:
                return b'{}'


class Command(BaseCommand):
    help = 'Start a socket server for event normalization'

    option_list = BaseCommand.option_list + (
        make_option('--socket', dest='socket_file', help="Unix socket to bind to"),
    )

    def _check_socket_path(self, socket_file):
        if os.path.exists(socket_file):
            file_mode = os.stat(socket_file).st_mode
            if not stat.S_ISSOCK(file_mode):
                raise CommandError('File already exists and is not a socket')

        # Make sure the socket does not already exist
        try:
            os.unlink(socket_file)
        except OSError:
            if os.path.exists(socket_file):
                raise

    def handle(self, **options):
        socket_file = options.get('socket_file')
        if not socket_file:
            raise CommandError('Path to the socket file is required!')

        self.socket_file = os.path.abspath(socket_file)
        self._check_socket_path(socket_file)
        self.stdout.write('Binding to unix socket: %s' % (socket_file,))

        server = SocketServer.UnixStreamServer(socket_file, EventNormalizeHandler)
        server.serve_forever()
