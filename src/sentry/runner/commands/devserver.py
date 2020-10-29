from __future__ import absolute_import, print_function

import click
import six
import types
from six.moves.urllib.parse import urlparse
import threading

from sentry.runner.decorators import configuration, log_options

_DEFAULT_DAEMONS = {
    "worker": ["sentry", "run", "worker", "-c", "1", "--autoreload"],
    "cron": ["sentry", "run", "cron", "--autoreload"],
    "post-process-forwarder": [
        "sentry",
        "run",
        "post-process-forwarder",
        "--loglevel=debug",
        "--commit-batch-size=1",
    ],
    "ingest": ["sentry", "run", "ingest-consumer", "--all-consumer-types"],
    "server": ["sentry", "run", "web"],
    "storybook": ["yarn", "storybook"],
}


def _get_daemon(name):
    return (name, _DEFAULT_DAEMONS[name])


@click.command()
@click.option("--reload/--no-reload", default=True, help="Autoreloading of python files.")
@click.option(
    "--watchers/--no-watchers", default=True, help="Watch static files and recompile on changes."
)
@click.option("--workers/--no-workers", default=False, help="Run asynchronous workers.")
@click.option(
    "--prefix/--no-prefix", default=True, help="Show the service name prefix and timestamp"
)
@click.option(
    "--pretty/--no-pretty", default=False, help="Styleize various outputs from the devserver"
)
@click.option(
    "--styleguide/--no-styleguide",
    default=False,
    help="Start local styleguide web server on port 9001",
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
@log_options()
@configuration
def devserver(
    reload,
    watchers,
    workers,
    experimental_spa,
    styleguide,
    prefix,
    pretty,
    environment,
    debug_server,
    bind,
):
    "Starts a lightweight web server for development."

    if bind is None:
        bind = "127.0.0.1:8000"

    if ":" in bind:
        host, port = bind.split(":", 1)
        port = int(port)
    else:
        host = bind
        port = None

    import os

    os.environ["SENTRY_ENVIRONMENT"] = environment
    # NODE_ENV *must* use production for any prod-like environment as third party libraries look
    # for this magic constant
    os.environ["NODE_ENV"] = "production" if environment.startswith("prod") else environment

    from django.conf import settings
    from sentry import options
    from sentry.services.http import SentryHTTPServer

    url_prefix = options.get("system.url-prefix", "")
    parsed_url = urlparse(url_prefix)
    # Make sure we're trying to use a port that we can actually bind to
    needs_https = parsed_url.scheme == "https" and (parsed_url.port or 443) > 1024
    has_https = False

    if needs_https:
        from subprocess import check_output

        try:
            check_output(["which", "https"])
            has_https = True
        except Exception:
            has_https = False
            from sentry.runner.initializer import show_big_error

            show_big_error(
                [
                    "missing `https` on your `$PATH`, but https is needed",
                    "`$ brew install mattrobenolt/stuff/https`",
                ]
            )

    uwsgi_overrides = {
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
        os.environ["SENTRY_WEBPACK_PROXY_PORT"] = "%s" % proxy_port
        os.environ["SENTRY_BACKEND_PORT"] = "%s" % port

        # webpack and/or typescript is causing memory issues
        os.environ["NODE_OPTIONS"] = (
            (os.environ.get("NODE_OPTIONS", "") + " --max-old-space-size=4096")
        ).lstrip()

        # Replace the webpack watcher with the drop-in webpack-dev-server
        webpack_config = next(w for w in daemons if w[0] == "webpack")[1]
        webpack_config[0] = os.path.join(
            *os.path.split(webpack_config[0])[0:-1] + ("webpack-dev-server",)
        )

        daemons = [w for w in daemons if w[0] != "webpack"] + [("webpack", webpack_config)]
    else:
        # If we are the bare http server, use the http option with uwsgi protocol
        # See https://uwsgi-docs.readthedocs.io/en/latest/HTTP.html
        uwsgi_overrides.update(
            {
                # Make sure uWSGI spawns an HTTP server for us as we don't
                # have a proxy/load-balancer in front in dev mode.
                "http": "%s:%s" % (host, port),
                "protocol": "uwsgi",
                # This is needed to prevent https://git.io/fj7Lw
                "uwsgi-socket": None,
            }
        )

    if workers:
        if settings.CELERY_ALWAYS_EAGER:
            raise click.ClickException(
                "Disable CELERY_ALWAYS_EAGER in your settings file to spawn workers."
            )

        daemons += [_get_daemon("worker"), _get_daemon("cron")]

        from sentry import eventstream

        if eventstream.requires_post_process_forwarder():
            daemons += [_get_daemon("post-process-forwarder")]

    if settings.SENTRY_USE_RELAY:
        daemons += [_get_daemon("ingest")]

    if needs_https and has_https:
        https_port = six.text_type(parsed_url.port)
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
        return server.run()

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

    if styleguide:
        daemons += [_get_daemon("storybook")]

    cwd = os.path.realpath(os.path.join(settings.PROJECT_ROOT, os.pardir, os.pardir))

    honcho_printer = Printer(prefix=prefix)

    if pretty:
        from sentry.runner.formatting import monkeypatch_honcho_write

        honcho_printer.write = types.MethodType(monkeypatch_honcho_write, honcho_printer)

    manager = Manager(honcho_printer)
    for name, cmd in daemons:
        manager.add_process(name, list2cmdline(cmd), quiet=False, cwd=cwd)

    manager.loop()
    sys.exit(manager.returncode)
