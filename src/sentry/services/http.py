from __future__ import annotations

import os
from collections.abc import MutableMapping
from typing import Any, NoReturn

from granian import Granian
from granian.constants import Interfaces as GranianInterfaces

from sentry.services.base import Service


def _run_server(options: dict[str, Any]):
    server = Granian(
        target=options["module"],
        address=options["host"],
        port=options["port"],
        interface=GranianInterfaces.WSGI,
        workers=options["workers"],
        backlog=options["backlog"],
        workers_kill_timeout=30,
        blocking_threads=options["threads"],
        respawn_failed_workers=True,
        reload=options["reload"],
        reload_ignore_worker_failure=options["reload_ignore_worker_failure"],
        process_name=options["process-name"],
        workers_max_rss=options["reload-on-rss"],
        log_access=options["log-enabled"],
        log_access_format=options["log-format"],
    )
    server.serve()


class SentryHTTPServer(Service):
    name = "http"

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        debug: bool = False,
        workers: int | None = None,
        extra_options: dict[str, Any] | None = None,
    ) -> None:
        from django.conf import settings

        from sentry import options as sentry_options
        from sentry.logging import LoggingFormat

        host = host or settings.SENTRY_WEB_HOST or "127.0.0.1"
        port = port or settings.SENTRY_WEB_PORT or 9000
        workers = workers or 1

        options = (settings.SENTRY_WEB_OPTIONS or {}).copy()
        if extra_options is not None:
            for k, v in extra_options.items():
                options[k] = v

        options.setdefault("module", "sentry.wsgi:application")
        options.setdefault("host", host)
        options.setdefault("port", port)
        options.setdefault("workers", workers)
        options.setdefault("threads", None)
        options.setdefault("backlog", max(128, 64 * workers))
        options.setdefault("log-enabled", True)
        options.setdefault("proc-name", "sentry")
        options.setdefault("reload", False)
        options.setdefault("reload-ignore-worker-failure", False)
        options.setdefault("workers-kill-timeout", 30)
        options.setdefault("reload-on-rss", 600)
        options.setdefault(
            "log-format", '%(addr)s - [%(time)s] "%(method)s %(path)s %(scheme)s" %(status)d'
        )

        # For machine logging, we are choosing to 100% disable logging
        # from granian since it's currently not possible to get a nice json
        # logging out of uwsgi, so it's better to just opt out. There's
        # also an assumption that anyone operating at the scale of needing
        # machine formatted logs, they are also using nginx in front which
        # has it's own logs that can be formatted correctly.
        if sentry_options.get("system.logging-format") == LoggingFormat.MACHINE:
            options["disable-logging"] = True

        # Old options from uwsgi
        if "procname-prefix-spaced" in options:
            options["proc-name"] = options.pop("procname-prefix-spaced")
        if "disable-logging" in options:
            options["log-enabled"] = not options.pop("disable-logging")

        self.options = options
        self.debug = debug

    def prepare_environment(self, env: MutableMapping[str, str] | None = None) -> None:
        from django.conf import settings

        if env is None:
            env = os.environ

        # Signal that we're running within uwsgi
        env["SENTRY_RUNNING_UWSGI"] = "1" if settings.SENTRY_USE_UWSGI else "0"

        # This has already been validated inside __init__
        env["SENTRY_SKIP_BACKEND_VALIDATION"] = "1"

    def run(self) -> NoReturn:
        self.prepare_environment()
        if self.debug or os.environ.get("SENTRY_RUNNING_UWSGI") == "0":
            from wsgiref.simple_server import make_server

            from sentry.wsgi import application

            httpd = make_server(self.options["host"], self.options["port"], application)
            httpd.serve_forever()
            raise AssertionError("unreachable")
        else:
            _run_server(self.options)
