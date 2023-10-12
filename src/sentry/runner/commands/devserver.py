from __future__ import annotations

import shutil
import threading
import types
from typing import List, MutableSequence, NoReturn, Sequence
from urllib.parse import urlparse

import click

from sentry.runner.commands.devservices import get_docker_client
from sentry.runner.decorators import configuration, log_options

_DEV_METRICS_INDEXER_ARGS = [
    # We don't really need more than 1 process.
    "--processes",
    "1",
    # Avoid Offset out of range errors.
    "--auto-offset-reset",
    "latest",
    "--no-strict-offset-reset",
]

# NOTE: These do NOT start automatically. Add your daemon to the `daemons` list
# in `devserver()` like so:
#     daemons += [_get_daemon("my_new_daemon")]
#
# If you are looking to add a kafka consumer, please do not create a new click
# subcommand. Instead, use sentry.consumers.
_DEFAULT_DAEMONS = {
    "worker": ["sentry", "run", "worker", "-c", "1", "--autoreload"],
    "celery-beat": ["sentry", "run", "cron", "--autoreload"],
    "server": ["sentry", "run", "web"],
}

_SUBSCRIPTION_RESULTS_CONSUMERS = [
    "events-subscription-results",
    "transactions-subscription-results",
    "generic-metrics-subscription-results",
    "sessions-subscription-results",
    "metrics-subscription-results",
]


def add_daemon(name: str, command: list[str]) -> None:
    """
    Used by getsentry to add additional workers to the devserver setup.
    """
    if name in _DEFAULT_DAEMONS:
        raise KeyError(f"The {name} worker has already been defined")
    _DEFAULT_DAEMONS[name] = command


def _get_daemon(name: str) -> tuple[str, list[str]]:
    return name, _DEFAULT_DAEMONS[name]


@click.command()
@click.option(
    "--reload/--no-reload",
    default=True,
    help="Autoreloading of python files.",
)
@click.option(
    "--watchers/--no-watchers",
    default=True,
    help="Watch static files and recompile on changes.",
)
@click.option(
    "--workers/--no-workers",
    default=False,
    help="Run celery workers (excluding celerybeat).",
)
@click.option(
    "--celery-beat/--no-celery-beat",
    default=False,
    help="Run celerybeat workers.",
)
@click.option(
    "--ingest/--no-ingest",
    default=False,
    help="Run ingest services (including Relay).",
)
@click.option(
    "--occurrence-ingest/--no-occurrence-ingest",
    default=False,
    help="Run ingest services for occurrences.",
)
@click.option(
    "--prefix/--no-prefix",
    default=True,
    help="Show the service name prefix and timestamp",
)
@click.option(
    "--dev-consumer/--no-dev-consumer",
    default=False,
    help="Fold multiple kafka consumers into one process using 'sentry run dev-consumer'.",
)
@click.option(
    "--pretty/--no-pretty",
    default=False,
    help="Stylize various outputs from the devserver",
)
@click.option(
    "--environment",
    default="development",
    help="The environment name.",
)
@click.option(
    "--debug-server/--no-debug-server",
    default=False,
    required=False,
    help="Start web server in same process",
)
@click.option(
    "--experimental-spa/--no-experimental-spa",
    default=False,
    help="This enables running sentry with pure separation of the frontend and backend",
)
@click.option(
    "--client-hostname",
    default="localhost",
    help="The hostname that clients will use. Useful for ngrok workflows eg `--client-hostname=alice.ngrok.io`",
)
@click.argument(
    "bind",
    default=None,
    metavar="ADDRESS",
    envvar="SENTRY_DEVSERVER_BIND",
    required=False,
)
@click.option("--enable-dlq", "dlq_consumers", multiple=True, help="The consumer to enable DLQ for")
@log_options()  # needs this decorator to be typed
@configuration  # needs this decorator to be typed
def devserver(
    reload: bool,
    watchers: bool,
    workers: bool,
    celery_beat: bool,
    ingest: bool,
    occurrence_ingest: bool,
    experimental_spa: bool,
    prefix: bool,
    pretty: bool,
    environment: str,
    debug_server: bool,
    dev_consumer: bool,
    bind: str | None,
    client_hostname: str,
    dlq_consumers: List[str] | None,
) -> NoReturn:
    "Starts a lightweight web server for development."
    if bind is None:
        bind = "127.0.0.1:8000"

    if ":" in bind:
        host, port_s = bind.split(":", 1)
        port = int(port_s)
    else:
        raise SystemExit(f"expected <host>:<port>, got {bind}")

    import os

    os.environ["SENTRY_ENVIRONMENT"] = environment
    # NODE_ENV *must* use production for any prod-like environment as third party libraries look
    # for this magic constant
    os.environ["NODE_ENV"] = "production" if environment.startswith("prod") else environment

    # Configure URL prefixes for customer-domains.
    client_host = f"{client_hostname}:{port}"
    os.environ["SENTRY_SYSTEM_URL_PREFIX"] = f"http://{client_host}"
    os.environ["SENTRY_SYSTEM_BASE_HOSTNAME"] = client_host
    os.environ["SENTRY_ORGANIZATION_BASE_HOSTNAME"] = f"{{slug}}.{client_host}"
    os.environ["SENTRY_ORGANIZATION_URL_TEMPLATE"] = "http://{hostname}"

    from django.conf import settings

    from sentry import options
    from sentry.services.http import SentryHTTPServer

    url_prefix = options.get("system.url-prefix")
    parsed_url = urlparse(url_prefix)

    # Make sure we're trying to use a port that we can actually bind to
    needs_https = parsed_url.scheme == "https" and (parsed_url.port or 443) > 1024
    has_https = shutil.which("https") is not None

    if needs_https and not has_https:
        from sentry.runner.initializer import show_big_error

        show_big_error(
            [
                "missing `https` on your `$PATH`, but https is needed",
                "`$ brew install mattrobenolt/stuff/https`",
            ]
        )

    uwsgi_overrides: dict[str, int | bool | str | None] = {
        "http-keepalive": True,
        # Make sure we reload really quickly for local dev in case it
        # doesn't want to shut down nicely on it's own, NO MERCY
        "worker-reload-mercy": 2,
        # We need stdin to support pdb in devserver
        "honour-stdin": True,
        # accept ridiculously large files
        "limit-post": 1 << 30,
        # do something with chunked
        "http-chunked-input": True,
        "thunder-lock": False,
        "timeout": 600,
        "harakiri": 600,
    }

    if reload:
        uwsgi_overrides["py-autoreload"] = 1

    daemons: MutableSequence[tuple[str, Sequence[str]]] = []
    kafka_consumers: set[str] = set()

    if experimental_spa:
        os.environ["SENTRY_UI_DEV_ONLY"] = "1"
        if not watchers:
            click.secho(
                "Using experimental SPA mode without watchers enabled has no effect",
                err=True,
                fg="yellow",
            )

    # Configure ports based on options and environment vars
    # If present, webpack is given the 'bind' address as it proxies
    # requests to the server instances.
    # When we're running multiple servers control + region servers are offset
    # from webpack and each other.
    ports = {
        "server": port,
    }
    if settings.USE_SILOS:
        if watchers:
            ports["webpack"] = port
            ports["control.server"] = port + 1
            ports["region.server"] = port + 10
        else:
            ports["control.server"] = port
            ports["region.server"] = port + 10
    elif watchers:
        ports["webpack"] = port
        ports["server"] = port + 1

    # Set ports to environment variables so that child processes can read them
    os.environ["SENTRY_BACKEND_PORT"] = str(ports.get("region.server") or ports.get("server"))
    if settings.USE_SILOS:
        os.environ["SENTRY_CONTROL_SILO_PORT"] = str(ports["control.server"])

    # We proxy all requests through webpacks devserver on the configured port.
    # The backend is served on port+1 and is proxied via the webpack
    # configuration.
    if watchers:
        daemons += settings.SENTRY_WATCHERS
        uwsgi_overrides["protocol"] = "http"

        os.environ["FORCE_WEBPACK_DEV_SERVER"] = "1"
        os.environ["SENTRY_WEBPACK_PROXY_HOST"] = "%s" % host
        os.environ["SENTRY_WEBPACK_PROXY_PORT"] = str(ports["webpack"])

        # webpack and/or typescript is causing memory issues
        os.environ["NODE_OPTIONS"] = (
            os.environ.get("NODE_OPTIONS", "") + " --max-old-space-size=4096"
        ).lstrip()
    else:
        server_port = os.environ["SENTRY_BACKEND_PORT"]
        # If we are the bare http server, use the http option with uwsgi protocol
        # See https://uwsgi-docs.readthedocs.io/en/latest/HTTP.html
        uwsgi_overrides.update(
            {
                # Make sure uWSGI spawns an HTTP server for us as we don't
                # have a proxy/load-balancer in front in dev mode.
                "http": f"{host}:{server_port}",
                "protocol": "uwsgi",
                # This is needed to prevent https://github.com/getsentry/sentry/blob/c6f9660e37fcd9c1bbda8ff4af1dcfd0442f5155/src/sentry/services/http.py#L70
                "uwsgi-socket": None,
            }
        )

    os.environ["SENTRY_USE_RELAY"] = "1" if settings.SENTRY_USE_RELAY else ""

    if ingest and not workers:
        click.echo("--ingest was provided, implicitly enabling --workers")
        workers = True

    if workers and not celery_beat:
        click.secho(
            "If you want to run periodic tasks from celery (celerybeat), you need to also pass --celery-beat.",
            fg="yellow",
        )

    if celery_beat:
        daemons.append(_get_daemon("celery-beat"))

    if workers:
        kafka_consumers.update(settings.DEVSERVER_START_KAFKA_CONSUMERS)

        if settings.CELERY_ALWAYS_EAGER:
            raise click.ClickException(
                "Disable CELERY_ALWAYS_EAGER in your settings file to spawn workers."
            )

        daemons.append(_get_daemon("worker"))

        from sentry import eventstream

        if eventstream.backend.requires_post_process_forwarder():
            kafka_consumers.add("post-process-forwarder-errors")
            kafka_consumers.add("post-process-forwarder-transactions")
            kafka_consumers.add("post-process-forwarder-issue-platform")

        daemons.extend([_get_daemon(name) for name in settings.SENTRY_EXTRA_WORKERS])

        if settings.SENTRY_DEV_PROCESS_SUBSCRIPTIONS:
            kafka_consumers.update(_SUBSCRIPTION_RESULTS_CONSUMERS)

        if settings.SENTRY_USE_METRICS_DEV and settings.SENTRY_USE_RELAY:
            kafka_consumers.add("ingest-metrics")
            kafka_consumers.add("ingest-generic-metrics")
            kafka_consumers.add("billing-metrics-consumer")

        if settings.SENTRY_USE_RELAY:
            daemons += [("relay", ["sentry", "devservices", "attach", "relay"])]

            kafka_consumers.add("ingest-events")
            kafka_consumers.add("ingest-attachments")
            kafka_consumers.add("ingest-transactions")
            kafka_consumers.add("ingest-monitors")
            kafka_consumers.add("ingest-spans")

            if settings.SENTRY_USE_PROFILING:
                kafka_consumers.add("ingest-profiles")

        if occurrence_ingest:
            kafka_consumers.add("ingest-occurrences")

    if needs_https and has_https:
        https_port = str(parsed_url.port)
        https_host = parsed_url.hostname

        # Determine a random port for the backend http server
        import socket

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((host, 0))
        port = s.getsockname()[1]
        s.close()
        bind = "%s:%d" % (host, port)

        daemons += [
            ("https", ["https", "-host", https_host, "-listen", host + ":" + https_port, bind])
        ]

    # Create all topics if the Kafka eventstream is selected
    if kafka_consumers:
        with get_docker_client() as docker:
            containers = {c.name for c in docker.containers.list(filters={"status": "running"})}
        if "sentry_kafka" not in containers:
            raise click.ClickException(
                f"""
Devserver is configured to start some kafka consumers, but Kafka
don't seem to be running.

The following consumers were intended to be started: {kafka_consumers}

Make sure you have:

    SENTRY_USE_RELAY = True

or:

    SENTRY_EVENTSTREAM = "sentry.eventstream.kafka.KafkaEventStream"

and run `sentry devservices up kafka`.

Alternatively, run without --workers.
"""
            )

        from sentry.utils.batching_kafka_consumer import create_topics

        for (topic_name, topic_data) in settings.KAFKA_TOPICS.items():
            if topic_data is not None:
                create_topics(topic_data["cluster"], [topic_name], force=True)

        if dev_consumer:
            daemons.append(
                ("dev-consumer", ["sentry", "run", "dev-consumer"] + list(kafka_consumers))
            )
        else:
            for name in kafka_consumers:
                daemons.append(
                    (
                        name,
                        [
                            "sentry",
                            "run",
                            "consumer",
                            name,
                            "--consumer-group=sentry-consumer",
                            "--auto-offset-reset=latest",
                            "--no-strict-offset-reset",
                            *(("--enable-dlq",) if dlq_consumers and name in dlq_consumers else ()),
                        ],
                    )
                )

    # A better log-format for local dev when running through honcho,
    # but if there aren't any other daemons, we don't want to override.
    if daemons:
        uwsgi_overrides["log-format"] = "%(method) %(status) %(uri) %(proto) %(size)"
    else:
        uwsgi_overrides["log-format"] = "[%(ltime)] %(method) %(status) %(uri) %(proto) %(size)"

    server_port = os.environ["SENTRY_BACKEND_PORT"]
    if settings.USE_SILOS:
        os.environ["SENTRY_SILO_MODE"] = "REGION"
        os.environ["SENTRY_REGION"] = "us"
        os.environ["SENTRY_REGION_API_URL_TEMPLATE"] = f"http://{{region}}.localhost:{server_port}"

        # Override variable set by SentryHTTPServer.prepare_environment()
        os.environ["SENTRY_DEVSERVER_BIND"] = f"localhost:{server_port}"

    server = SentryHTTPServer(
        host=host,
        port=int(server_port),
        workers=1,
        extra_options=uwsgi_overrides,
        debug=debug_server,
    )

    # If we don't need any other daemons, just launch a normal uwsgi webserver
    # and avoid dealing with subprocesses
    if not daemons and not settings.USE_SILOS:
        server.run()

    import sys
    from subprocess import list2cmdline

    from honcho.manager import Manager
    from honcho.printer import Printer

    os.environ["PYTHONUNBUFFERED"] = "true"

    if debug_server:
        threading.Thread(target=server.run).start()
    else:
        # Make sure that the environment is prepared before honcho takes over
        # This sets all the appropriate uwsgi env vars, etc
        server.prepare_environment()
        if settings.USE_SILOS:
            os.environ["UWSGI_HTTP_SOCKET"] = f"127.0.0.1:{server_port}"
        daemons += [_get_daemon("server")]

    cwd = os.path.realpath(os.path.join(settings.PROJECT_ROOT, os.pardir, os.pardir))

    honcho_printer = Printer(prefix=prefix)

    if pretty:
        from sentry.runner.formatting import monkeypatch_honcho_write

        honcho_printer.write = types.MethodType(monkeypatch_honcho_write, honcho_printer)

    manager = Manager(honcho_printer)
    for name, cmd in daemons:
        quiet = (
            name not in (settings.DEVSERVER_LOGS_ALLOWLIST or ())
            and settings.DEVSERVER_LOGS_ALLOWLIST
        )
        manager.add_process(name, list2cmdline(cmd), quiet=quiet, cwd=cwd)

    if settings.USE_SILOS:
        control_port = ports["control.server"]
        control_environ = {
            "SENTRY_SILO_MODE": "CONTROL",
            "SENTRY_REGION": "",
            "SENTRY_DEVSERVER_BIND": f"localhost:{control_port}",
            # Override variable set by SentryHTTPServer.prepare_environment()
            "UWSGI_HTTP_SOCKET": f"127.0.0.1:{control_port}",
        }
        merged_env = os.environ.copy()
        merged_env.update(control_environ)
        control_services = ["server"]
        if workers:
            control_services.append("worker")
        if celery_beat:
            control_services.append("celery-beat")

        for service in control_services:
            name, cmd = _get_daemon(service)
            name = f"control.{name}"
            quiet = (
                name not in (settings.DEVSERVER_LOGS_ALLOWLIST or ())
                and settings.DEVSERVER_LOGS_ALLOWLIST
            )
            manager.add_process(name, list2cmdline(cmd), quiet=quiet, cwd=cwd, env=merged_env)

    manager.loop()
    sys.exit(manager.returncode)
