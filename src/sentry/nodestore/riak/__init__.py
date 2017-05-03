"""
sentry.nodestore.riak
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from .backend import *  # NOQA


# HACK: Monkey patch the RiakPbcConnection client
# to enable TCP keepalives. This is to see if it fixes
# out connection timeout issues. If this works, ideally
# we contribute upstream
def patch_socket_keepalive():
    import socket

    from riak.transports.pbc.connection import RiakPbcConnection

    original_connect = RiakPbcConnection._connect

    def patched_connect(self):
        original_connect(self)
        s = self._socket

        if not s:
            return

        # Future-proof ourselves against the socket getting keepalive set already
        if s.getsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE):
            return

        # Enable TCP keepalive
        s.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)

    RiakPbcConnection._connect = patched_connect


try:
    patch_socket_keepalive()
except Exception as e:
    import logging
    logger = logging.getLogger('sentry')
    logger.exception(e)
