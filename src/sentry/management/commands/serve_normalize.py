import base64
import os
import resource
import stat
import sys
import time
import traceback
from optparse import make_option

import SocketServer
from django.core.management.base import BaseCommand, CommandError
from django.utils.encoding import force_str

from sentry.utils import json


class ForkingUnixStreamServer(SocketServer.ForkingMixIn, SocketServer.UnixStreamServer):
    pass


def catch_errors(f):
    def wrapper(*args, **kwargs):
        error = None
        try:
            return f(*args, **kwargs)
        except Exception as e:
            error = force_str(str(e)) + " " + force_str(traceback.format_exc())

        try:
            return encode({"result": None, "error": error, "metrics": None})
        except (ValueError, TypeError) as e:
            try:
                # Encoding error, try to send the exception instead
                return encode(
                    {
                        "result": None,
                        "error": force_str(str(e)) + " " + force_str(traceback.format_exc()),
                        "metrics": None,
                        "encoding_error": True,
                    }
                )
            except Exception:
                return b"{}"

    return wrapper


# Here's where the normalization itself happens
def process_event(data, meta, project_config):
    from sentry.event_manager import EventManager
    from sentry.relay.config import ProjectConfig
    from sentry.tasks.store import should_process
    from sentry.web.api import _scrub_event_data

    project_config = ProjectConfig(None, **project_config)

    event_manager = EventManager(
        data,
        client_ip=meta.get("REMOTE_ADDR"),
        user_agent=meta.get("HTTP_USER_AGENT"),
        auth=None,
        key=None,
        content_encoding=meta.get("HTTP_CONTENT_ENCODING"),
    )
    event_manager.normalize()

    event = event_manager.get_data()
    group_hash = None

    datascrubbing_settings = project_config.config.get("datascrubbingSettings") or {}
    event = _scrub_event_data(event, datascrubbing_settings)

    if not should_process(event):
        group_hash = event_manager._get_event_instance(project_id=1).get_hashes()
    return {"event": dict(event), "group_hash": group_hash}


def decode(message):
    meta, data_encoded, project_config = json.loads(message)
    data = base64.b64decode(data_encoded)
    return data, meta, project_config


def encode(data):
    # Normalized data should be serializable
    return json.dumps(data)


@catch_errors
def handle_data(data):
    mc = MetricCollector()

    metrics_before = mc.collect_metrics()
    data, meta, project_config = decode(data)
    rv = process_event(data, meta, project_config)
    metrics_after = mc.collect_metrics()

    return encode(
        {"result": rv, "metrics": {"before": metrics_before, "after": metrics_after}, "error": None}
    )


class MetricCollector:
    def __init__(self):
        self.is_linux = sys.platform.startswith("linux")
        self.pid = os.getpid()

    def collect_metrics(self):
        metrics = {"time": time.time()}

        usage = resource.getrusage(resource.RUSAGE_SELF)
        usage_dict = {attr: getattr(usage, attr) for attr in dir(usage) if attr.startswith("ru_")}
        metrics.update(usage_dict)

        if self.is_linux:
            with open(f"/proc/{self.pid}/status") as procfh:
                metrics["proc"] = procfh.read()

        return metrics


class EventNormalizeHandler(SocketServer.BaseRequestHandler):
    """
    The request handler class for our server.
    It is instantiated once per connection to the server, and must
    override the handle() method to implement communication to the
    client.
    """

    BUFFER_SIZE = 4096
    SOCKET_TIMEOUT = 10.0

    def handle(self):
        self.server.socket.settimeout(self.SOCKET_TIMEOUT)

        chunks = []

        # Receive the data
        while True:
            rcvd = self.request.recv(self.BUFFER_SIZE)
            if rcvd is None:
                raise ValueError("Received None")

            if not rcvd:
                break
            chunks.append(rcvd)

        self.data = "".join(chunks)

        response = self.handle_data()
        self.request.sendall(response)
        self.request.close()

    def handle_data(self):
        return handle_data(self.data)


class Command(BaseCommand):
    help = "Start a socket server for event normalization"

    option_list = BaseCommand.option_list + (
        make_option(
            "--unix",
            dest="socket_file",
            help='Unix socket to bind to. Example: "/tmp/normalize.sock"',
        ),
        make_option(
            "--net",
            dest="network_socket",
            help='Network socket to bind to. Example: "127.0.0.1:1234"',
        ),
        make_option(
            "--threading", action="store_true", dest="threading", help="Start a threading server"
        ),
        make_option(
            "--forking", action="store_true", dest="forking", help="Start a forking server"
        ),
    )

    def _check_socket_path(self, socket_file):
        if os.path.exists(socket_file):
            file_mode = os.stat(socket_file).st_mode
            if not stat.S_ISSOCK(file_mode):
                raise CommandError("File already exists and is not a socket")

        # Make sure the socket does not already exist
        try:
            os.unlink(socket_file)
        except OSError:
            if os.path.exists(socket_file):
                raise

    def handle(self, **options):
        socket_file = options.get("socket_file")
        network_socket = options.get("network_socket")
        threading = options.get("threading")
        forking = options.get("forking")
        if threading and forking:
            raise CommandError("Pick one: threading or forking.")
        if socket_file and network_socket:
            raise CommandError("Only one socket allowed at a time")

        if threading:
            server_type = "threading"
        elif forking:
            server_type = "forking"
        else:
            server_type = "single-threaded"
        self.stdout.write(f"Server type: {server_type}\n")

        if socket_file:
            self.socket_file = os.path.abspath(socket_file)
            self._check_socket_path(socket_file)
            self.stdout.write(f"Binding to unix socket: {socket_file}\n")
            if threading:
                server = SocketServer.ThreadingUnixStreamServer(socket_file, EventNormalizeHandler)
                server.daemon_threads = True
            elif forking:
                server = ForkingUnixStreamServer(socket_file, EventNormalizeHandler)
            else:
                server = SocketServer.UnixStreamServer(socket_file, EventNormalizeHandler)
        elif network_socket:
            host, port = network_socket.split(":")
            port = int(port)
            self.stdout.write(f"Binding to network socket: {host}:{port}\n")
            if threading:
                server = SocketServer.ThreadingTCPServer((host, port), EventNormalizeHandler)
                server.daemon_threads = True
            elif forking:
                server = SocketServer.ForkingTCPServer((host, port), EventNormalizeHandler)
            else:
                server = SocketServer.TCPServer((host, port), EventNormalizeHandler)
        else:
            raise CommandError("No connection option specified")

        server.serve_forever()
