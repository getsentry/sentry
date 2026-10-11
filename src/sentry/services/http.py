from __future__ import annotations

import gc
import logging
import multiprocessing
import os
import threading
from collections.abc import Mapping, MutableMapping
from importlib import import_module
from typing import Any

import sentry_sdk
from django.db import connections
from granian import Granian

from sentry.runner.boot_gc import env_flag
from sentry.services.base import Service

logger = logging.getLogger(__name__)

PRELOAD_ENV_VAR = "SENTRY_GRANIAN_PRELOAD"


def _granian_start_method() -> str:
    # How granian (2.8.2, WorkerProcess in granian/server/mp.py) starts workers:
    # anything but fork or spawn, e.g. forkserver (the Linux default from
    # Python 3.14), runs as spawn. allow_none=True: a bare get_start_method()
    # would pin the default, and a later set_start_method() would fail.
    method = (
        multiprocessing.get_start_method(allow_none=True)
        or multiprocessing.get_all_start_methods()[0]
    )
    return method if method in ("fork", "spawn") else "spawn"


def _preload_skip_reason(options: Mapping[str, Any], debug_server: bool) -> str | None:
    if debug_server:
        # wsgiref serves the app from this process, without workers.
        return "debug server"
    if options["reload"]:
        # The reloader re-forks workers from the master when a file changes, so
        # they would keep serving the code preloaded there.
        return "reload"
    start_method = _granian_start_method()
    if start_method != "fork":
        # Spawned workers start a new interpreter and import the app anyway.
        return f"{start_method} start method"
    return None


def _preload_app(target: str) -> None:
    """
    Import the app in the granian master before it forks any workers. granian
    (2.8.2, load_target) imports the target with __import__, so workers find it
    in sys.modules instead of each running the sentry.wsgi warmup again: the
    warm heap is shared copy-on-write, and every worker, respawns included,
    starts without the warmup. Worker RSS, and so reload-on-rss, still counts
    shared pages.

    The sharing lasts only with SENTRY_BOOT_GC_FREEZE=1, which freezes the warm
    heap here. Without it, each worker's first full collection writes GC
    bookkeeping into every inherited page, so workers end up about as large as
    without the preload, and only the warmup CPU saving remains.

    Since they skip the warmup, respawned workers serve within milliseconds of
    a crash, so a request that kills a worker (segfault, OOM kill) and is
    retried onto the same worker within granian's fixed 5.5 s crash-loop window
    now stops the whole server ("Worker crash loop detected, exiting"); without
    the preload, the warmup used part of that window.

    Workers run the code the master imported, so code changes need a master
    restart; a SIGHUP worker reload doesn't pick them up. atexit handlers
    registered by the import only run in the master: multiprocessing clears them
    in forked children, as it already does for everything configure() registers.

    An exception from the import propagates, so `sentry run web` exits before
    granian starts: no worker is forked from a half-imported app.
    """
    module = target.partition(":")[0]
    threads_before = set(threading.enumerate())

    # The warmup request would otherwise start an SDK session in the master.
    # Sending it a minute later starts the transport's thread and opens a pooled
    # connection to the DSN host; workers forked after that would share the
    # connection, and their transport would miss its first wakeup.
    with sentry_sdk.isolation_scope() as scope:
        scope.stop_auto_session_tracking()
        # Nor any error or transaction, for the same reason. Django and the
        # console log handlers still print these errors. Spans that the span
        # batcher streams, from a sampled warmup transaction, skip event
        # processors: the threads_started warning below still reports them.
        scope.add_event_processor(lambda event, hint: None)
        import_module(module)

    # request_started only closes expired DB connections, and request_finished
    # never fires because the warmup doesn't close its response, so connections
    # from configure() or the warmup can still be open. Don't fork them.
    connections.close_all()

    # Workers, respawns included, keep being forked from this process, so report
    # any thread the import left running (none should be).
    new_threads = [t.name for t in threading.enumerate() if t not in threads_before]
    if new_threads:
        logger.warning("granian.preload.threads_started", extra={"threads": new_threads})
    # Whether the import froze the warm heap (SENTRY_BOOT_GC_FREEZE), so that
    # workers keep sharing it.
    logger.info(
        "granian.preload.done", extra={"target": module, "gc_frozen": gc.get_freeze_count()}
    )


def _run_server(options: dict[str, Any]):
    server = Granian(
        target=options["module"],
        address=options["host"],
        port=options["port"],
        interface=options["iface"],
        workers=options["workers"],
        backlog=options["backlog"],
        workers_kill_timeout=options["workers-kill-timeout"],
        blocking_threads=options["threads"],
        respawn_failed_workers=True,
        reload=options["reload"],
        reload_ignore_dirs=options.get("reload-ignore-dirs"),
        reload_ignore_worker_failure=options["reload-ignore-worker-failure"],
        process_name=options["proc-name"],
        workers_lifetime=options["max-worker-lifetime"],
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

        from sentry.logging import LoggingFormat

        host = host or settings.SENTRY_WEB_HOST
        port = port or int(os.environ.get("SENTRY_GRANIAN_PORT", "0")) or settings.SENTRY_WEB_PORT
        workers = workers or int(os.environ.get("SENTRY_GRANIAN_WORKERS", "1"))
        iface = os.environ.get("SENTRY_GRANIAN_IFACE", "wsgi")
        reload = bool(os.environ.get("SENTRY_GRANIAN_RELOAD"))

        options = (settings.SENTRY_WEB_OPTIONS or {}).copy()
        if extra_options is not None:
            for k, v in extra_options.items():
                options[k] = v

        options.setdefault("module", f"sentry.{iface[:4]}:application")
        options.setdefault("iface", iface)
        options.setdefault("host", host)
        options.setdefault("port", port)
        options.setdefault("workers", workers)
        options.setdefault("threads", None)
        options.setdefault("backlog", max(128, 64 * options["workers"]))
        options.setdefault("log-enabled", True)
        options.setdefault("proc-name", "sentry")
        options.setdefault("reload", reload)
        options.setdefault("reload-ignore-dirs", [".artifacts"])
        options.setdefault("reload-ignore-worker-failure", reload)
        options.setdefault("workers-kill-timeout", 3 if reload else 30)
        options.setdefault("max-worker-lifetime", None)
        options.setdefault("reload-on-rss", 600)
        options.setdefault(
            "log-format", '%(addr)s - [%(time)s] "%(method)s %(path)s %(scheme)s" %(status)d'
        )

        # FIXME: while this was true with uwsgi, Granian allows logging customisation
        #        through the stdlib `logging` module. Thus, it's now possible
        #        to configure the logger to output json.
        # For machine logging, we are choosing to 100% disable logging
        # from uwsgi since it's currently not possible to get a nice json
        # logging out of uwsgi, so it's better to just opt out. There's
        # also an assumption that anyone operating at the scale of needing
        # machine formatted logs, they are also using nginx in front which
        # has it's own logs that can be formatted correctly.
        if settings.SENTRY_LOGGING_FORMAT == LoggingFormat.MACHINE:
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

        # Signal that we're running within granian
        env["SENTRY_RUNNING_GRANIAN"] = "1" if settings.SENTRY_USE_GRANIAN else "0"

        # This has already been validated inside __init__
        env["SENTRY_SKIP_BACKEND_VALIDATION"] = "1"

    def run(self):
        self.prepare_environment()
        debug_server = self.debug or os.environ.get("SENTRY_RUNNING_GRANIAN") == "0"
        if env_flag(PRELOAD_ENV_VAR):
            skip_reason = _preload_skip_reason(self.options, debug_server)
            if skip_reason is None:
                _preload_app(self.options["module"])
            else:
                logger.warning("granian.preload.skipped", extra={"reason": skip_reason})
        if debug_server:
            from wsgiref.simple_server import make_server

            from sentry.wsgi import application

            httpd = make_server(self.options["host"], self.options["port"], application)
            httpd.serve_forever()
            raise AssertionError("unreachable")
        else:
            _run_server(self.options)
