from __future__ import annotations

import shutil
import threading
import types
from typing import NoReturn
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
_DEFAULT_DAEMONS = {
    "worker": ["sentry", "run", "worker", "-c", "1", "--autoreload"],
    "cron": ["sentry", "run", "cron", "--autoreload"],
    "post-process-forwarder": [
        "sentry",
        "run",
        "post-process-forwarder",
        "--entity=errors",
        "--loglevel=debug",
        "--no-strict-offset-reset",
    ],
    "post-process-forwarder-transactions": [
        "sentry",
        "run",
        "post-process-forwarder",
        "--entity=transactions",
        "--loglevel=debug",
        "--commit-log-topic=snuba-transactions-commit-log",
        "--synchronize-commit-group=transactions_group",
        "--no-strict-offset-reset",
    ],
    "post-process-forwarder-issue-platform": [
        "sentry",
        "run",
        "post-process-forwarder",
        "--entity=search_issues",
        "--loglevel=debug",
        "--commit-log-topic=snuba-generic-events-commit-log",
        "--synchronize-commit-group=generic_events_group",
        "--no-strict-offset-reset",
    ],
    "ingest": ["sentry", "run", "ingest-consumer", "--all-consumer-types"],
    "occurrences": ["sentry", "run", "occurrences-ingest-consumer", "--no-strict-offset-reset"],
    "server": ["sentry", "run", "web"],
    "subscription-consumer": [
        "sentry",
        "run",
        "query-subscription-consumer",
        "--no-strict-offset-reset",
        "latest",
    ],
    "metrics-rh": [
        "sentry",
        "run",
        "ingest-metrics-parallel-consumer",
        "--ingest-profile",
        "release-health",
        *_DEV_METRICS_INDEXER_ARGS,
    ],
    "metrics-perf": [
        "sentry",
        "run",
        "ingest-metrics-parallel-consumer",
        "--ingest-profile",
        "performance",
        *_DEV_METRICS_INDEXER_ARGS,
    ],
    "metrics-billing": ["sentry", "run", "billing-metrics-consumer", "--no-strict-offset-reset"],
    "profiles": ["sentry", "run", "ingest-profiles", "--no-strict-offset-reset"],
    "monitors": ["sentry", "run", "ingest-monitors", "--no-strict-offset-reset"],
}


def add_daemon(name: str, command: list[str]) -> None:
    """
    Used by getsentry to add additional workers to the devserver setup.
    """
    if name in _DEFAULT_DAEMONS:
        raise KeyError(f"The {name} worker has already been defined")
    _DEFAULT_DAEMONS[name] = command


def _get_daemon(name: str, *args: str, **kwargs: str) -> tuple[str, list[str]]:
    display_name = name
    if "suffix" in kwargs:
        display_name = "{}-{}".format(name, kwargs["suffix"])

    return (display_name, _DEFAULT_DAEMONS[name] + list(args))


@click.command()
@click.option("--reload/--no-reload", default=True, help="Autoreloading of python files.")
@click.option(
    "--watchers/--no-watchers", default=True, help="Watch static files and recompile on changes."
)
@click.option("--workers/--no-workers", default=False, help="Run asynchronous workers.")
@click.option("--ingest/--no-ingest", default=False, help="Run ingest services (including Relay).")
@click.option(
    "--occurrence-ingest/--no-occurrence-ingest",
    default=False,
    help="Run ingest services for occurrences.",
)
@click.option(
    "--prefix/--no-prefix", default=True, help="Show the service name prefix and timestamp"
)
@click.option(
    "--pretty/--no-pretty", default=False, help="Stylize various outputs from the devserver"
)
@click.option("--environment", default="development", help="The environment name.")
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
@click.argument(
    "bind", default=None, metavar="ADDRESS", envvar="SENTRY_DEVSERVER_BIND", required=False
)
@log_options()  # type: ignore[misc]  # needs this decorator to be typed
@configuration  # type: ignore[misc]  # needs this decorator to be typed
def devserver(
    reload: bool,
    watchers: bool,
    workers: bool,
    ingest: bool,
    occurrence_ingest: bool,
    experimental_spa: bool,
    prefix: bool,
    pretty: bool,
    environment: str,
    debug_server: bool,
    bind: str | None,
) -> NoReturn:
    "Starts a lightweight web server for development."
    if ingest:
        # Ingest requires kakfa+zookeeper to be running.
        # They're too heavyweight to startup on-demand with devserver.
        with get_docker_client() as docker:
            containers = {c.name for c in docker.containers.list(filters={"status": "running"})}
        if "sentry_zookeeper" not in containers or "sentry_kafka" not in containers:
            raise SystemExit(
                """
Kafka + Zookeeper don't seem to be running.
Make sure you have settings.SENTRY_USE_RELAY = True,
and run `sentry devservices up kafka zookeeper`.
"""
            )

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
    os.environ["SENTRY_SYSTEM_URL_PREFIX"] = f"http://localhost:{port}"
    os.environ["SENTRY_SYSTEM_BASE_HOSTNAME"] = f"localhost:{port}"
    os.environ["SENTRY_ORGANIZATION_BASE_HOSTNAME"] = f"{{slug}}.localhost:{port}"
    os.environ["SENTRY_ORGANIZATION_URL_TEMPLATE"] = "http://{hostname}"
    os.environ["SENTRY_REGION_API_URL_TEMPLATE"] = f"http://{{region}}.localhost:{port}"

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

    daemons = []

    if experimental_spa:
        os.environ["SENTRY_UI_DEV_ONLY"] = "1"
        if not watchers:
            click.secho(
                "Using experimental SPA mode without watchers enabled has no effect",
                err=True,
                fg="yellow",
            )

    # We proxy all requests through webpacks devserver on the configured port.
    # The backend is served on port+1 and is proxied via the webpack
    # configuration.
    if watchers:
        daemons += settings.SENTRY_WATCHERS

        proxy_port = port
        port = port + 1

        uwsgi_overrides["protocol"] = "http"

        os.environ["FORCE_WEBPACK_DEV_SERVER"] = "1"
        os.environ["SENTRY_WEBPACK_PROXY_HOST"] = "%s" % host
        os.environ["SENTRY_WEBPACK_PROXY_PORT"] = "%s" % proxy_port
        os.environ["SENTRY_BACKEND_PORT"] = "%s" % port

        # webpack and/or typescript is causing memory issues
        os.environ["NODE_OPTIONS"] = (
            os.environ.get("NODE_OPTIONS", "") + " --max-old-space-size=4096"
        ).lstrip()
    else:
        # If we are the bare http server, use the http option with uwsgi protocol
        # See https://uwsgi-docs.readthedocs.io/en/latest/HTTP.html
        uwsgi_overrides.update(
            {
                # Make sure uWSGI spawns an HTTP server for us as we don't
                # have a proxy/load-balancer in front in dev mode.
                "http": f"{host}:{port}",
                "protocol": "uwsgi",
                # This is needed to prevent https://github.com/getsentry/sentry/blob/c6f9660e37fcd9c1bbda8ff4af1dcfd0442f5155/src/sentry/services/http.py#L70
                "uwsgi-socket": None,
            }
        )

    os.environ["SENTRY_USE_RELAY"] = "1" if settings.SENTRY_USE_RELAY else ""

    if workers:
        if settings.CELERY_ALWAYS_EAGER:
            raise click.ClickException(
                "Disable CELERY_ALWAYS_EAGER in your settings file to spawn workers."
            )

        daemons += [_get_daemon("worker"), _get_daemon("cron")]

        from sentry import eventstream

        if eventstream.requires_post_process_forwarder():
            daemons += [_get_daemon("post-process-forwarder")]
            daemons += [_get_daemon("post-process-forwarder-transactions")]
            daemons += [_get_daemon("post-process-forwarder-issue-platform")]

        if settings.SENTRY_EXTRA_WORKERS:
            daemons.extend([_get_daemon(name) for name in settings.SENTRY_EXTRA_WORKERS])

        if settings.SENTRY_DEV_PROCESS_SUBSCRIPTIONS:
            if not settings.SENTRY_EVENTSTREAM == "sentry.eventstream.kafka.KafkaEventStream":
                raise click.ClickException(
                    "`SENTRY_DEV_PROCESS_SUBSCRIPTIONS` can only be used when "
                    "`SENTRY_EVENTSTREAM=sentry.eventstream.kafka.KafkaEventStream`."
                )
            for name, topic in settings.KAFKA_SUBSCRIPTION_RESULT_TOPICS.items():
                daemons += [_get_daemon("subscription-consumer", "--topic", topic, suffix=name)]

        if settings.SENTRY_USE_METRICS_DEV and settings.SENTRY_USE_RELAY:
            if not settings.SENTRY_EVENTSTREAM == "sentry.eventstream.kafka.KafkaEventStream":
                # The metrics indexer produces directly to kafka, so it makes
                # no sense to run it with SnubaEventStream.
                raise click.ClickException(
                    "`SENTRY_USE_METRICS_DEV` can only be used when "
                    "`SENTRY_EVENTSTREAM=sentry.eventstream.kafka.KafkaEventStream`."
                )
            daemons += [
                _get_daemon("metrics-rh"),
                _get_daemon("metrics-perf"),
                _get_daemon("metrics-billing"),
            ]

    if settings.SENTRY_USE_RELAY:
        daemons += [_get_daemon("ingest"), _get_daemon("monitors")]

        if settings.SENTRY_USE_PROFILING:
            daemons += [_get_daemon("profiles")]

    if occurrence_ingest:
        daemons += [_get_daemon("occurrences")]

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
    if settings.SENTRY_EVENTSTREAM == "sentry.eventstream.kafka.KafkaEventStream":
        from sentry.utils.batching_kafka_consumer import create_topics

        for (topic_name, topic_data) in settings.KAFKA_TOPICS.items():
            if topic_data is not None:
                create_topics(topic_data["cluster"], [topic_name], force=True)

    from sentry.runner.commands.devservices import _prepare_containers

    for name, container_options in _prepare_containers("sentry", silent=True).items():
        if container_options.get("with_devserver", False):
            daemons += [(name, ["sentry", "devservices", "attach", "--fast", name])]

    # A better log-format for local dev when running through honcho,
    # but if there aren't any other daemons, we don't want to override.
    if daemons:
        uwsgi_overrides["log-format"] = "%(method) %(status) %(uri) %(proto) %(size)"
    else:
        uwsgi_overrides["log-format"] = "[%(ltime)] %(method) %(status) %(uri) %(proto) %(size)"

    server = SentryHTTPServer(
        host=host, port=port, workers=1, extra_options=uwsgi_overrides, debug=debug_server
    )

    # If we don't need any other daemons, just launch a normal uwsgi webserver
    # and avoid dealing with subprocesses
    if not daemons:
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
        daemons += [_get_daemon("server")]

    cwd = os.path.realpath(os.path.join(settings.PROJECT_ROOT, os.pardir, os.pardir))

    honcho_printer = Printer(prefix=prefix)

    if pretty:
        from sentry.runner.formatting import monkeypatch_honcho_write

        honcho_printer.write = types.MethodType(monkeypatch_honcho_write, honcho_printer)

    manager = Manager(honcho_printer)
    for name, cmd in daemons:
        quiet = (
            name not in settings.DEVSERVER_LOGS_ALLOWLIST
            if settings.DEVSERVER_LOGS_ALLOWLIST is not None
            else False
        )
        manager.add_process(name, list2cmdline(cmd), quiet=quiet, cwd=cwd)

    manager.loop()
    sys.exit(manager.returncode)
