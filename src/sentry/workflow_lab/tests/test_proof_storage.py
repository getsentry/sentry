import os
import select
import socket
from threading import Event
from unittest.mock import patch

from sentry.workflow_lab.proof_storage import proof_storage


def test_child_startup_can_outlast_the_network_socket_timeout():
    parent, child = socket.socketpair()
    # Sentry sets a process-wide timeout on new sockets.
    for sock in (parent, child):
        sock.settimeout(0.01)
    ready = Event()

    def serve(sock, org, keep):
        with sock:
            ready.set()
            assert sock.recv(1) == b"?"
            sock.sendall(b"!")

    with (
        patch("sentry.workflow_lab.proof_storage.socket.socketpair", return_value=(parent, child)),
        patch("sentry.workflow_lab.proof_storage._serve", serve),
        proof_storage(1, False) as fd,
    ):
        assert ready.wait(timeout=2)
        # A cold child is still starting. The parent keeps the channel open.
        assert not select.select([fd], [], [], 0.05)[0]
        os.write(fd, b"?")
        assert os.read(fd, 1) == b"!"
