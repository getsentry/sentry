from __future__ import annotations

import gc
import os
import subprocess
import sys
import threading
import types
from collections.abc import Generator
from unittest import mock

import pytest
import sentry_sdk
from django.test.utils import override_settings

from sentry.services.http import SentryHTTPServer
from sentry.testutils.cases import TestCase


class HTTPServiceTest(TestCase):
    def test_options(self) -> None:
        cls = SentryHTTPServer

        server = cls(host="1.1.1.1", port=80)
        assert server.options["host"] == "1.1.1.1"
        assert server.options["port"] == 80

        with override_settings(SENTRY_WEB_HOST="1.1.1.1", SENTRY_WEB_PORT=80):
            assert server.options["host"] == "1.1.1.1"
            assert server.options["port"] == 80

        server = cls(workers=10)
        assert server.options["workers"] == 10

        options = {
            "host": "1.1.1.1",
            "port": 80,
            "proc-name": "LOL",
            "secure_scheme_headers": {},
            "loglevel": "info",
        }
        with override_settings(SENTRY_WEB_OPTIONS=options):
            server = cls()
            assert server.options["host"] == "1.1.1.1"
            assert server.options["port"] == 80
            assert server.options["proc-name"] == "LOL"

    def test_format_logs(self) -> None:
        with override_settings(SENTRY_LOGGING_FORMAT="human"):
            server = SentryHTTPServer()
            assert server.options["log-enabled"] is True
        with override_settings(SENTRY_LOGGING_FORMAT="machine"):
            server = SentryHTTPServer()
            assert server.options["log-enabled"] is False


@pytest.fixture
def calls() -> Generator[mock.Mock]:
    """
    Records, in order, what SentryHTTPServer.run() does in the granian master.
    Nothing is imported or served, and no DB connection is closed.
    """
    calls = mock.Mock()
    calls.get_start_method.return_value = "fork"
    # run() writes to os.environ: patch.dict restores it afterwards.
    with (
        mock.patch.dict(os.environ),
        mock.patch("sentry.services.http.Granian", calls.Granian),
        mock.patch("sentry.services.http.import_module", calls.import_module),
        mock.patch("sentry.services.http.connections", calls.connections),
        mock.patch("sentry.services.http.logger", calls.logger),
        mock.patch("multiprocessing.get_start_method", calls.get_start_method),
    ):
        # Whatever the shell exports.
        for name in (
            "SENTRY_GRANIAN_PRELOAD",
            "SENTRY_GRANIAN_RELOAD",
            "SENTRY_GRANIAN_IFACE",
            "SENTRY_RUNNING_GRANIAN",
        ):
            os.environ.pop(name, None)
        yield calls


def call_names(calls: mock.Mock) -> list[str]:
    return [name for name, _, _ in calls.mock_calls]


def test_preload_imports_app_before_serving(calls: mock.Mock) -> None:
    with mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": "1"}):
        SentryHTTPServer().run()

    assert call_names(calls) == [
        "get_start_method",
        "import_module",
        "connections.close_all",
        "logger.info",
        "Granian",
        "Granian().serve",
    ]
    # Without locking in the default start method.
    calls.get_start_method.assert_called_once_with(allow_none=True)
    calls.import_module.assert_called_once_with("sentry.wsgi")
    # Workers still load the same target, and find it in sys.modules.
    assert calls.Granian.call_args.kwargs["target"] == "sentry.wsgi:application"


def test_preload_imports_module_of_configured_target(calls: mock.Mock) -> None:
    with mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": "1"}):
        SentryHTTPServer(extra_options={"module": "sentry.asgi:application"}).run()

    calls.import_module.assert_called_once_with("sentry.asgi")
    assert calls.Granian.call_args.kwargs["target"] == "sentry.asgi:application"


def test_failed_preload_stops_startup(calls: mock.Mock) -> None:
    # No fallback: workers must not be forked from a half-imported app.
    calls.import_module.side_effect = RuntimeError("warmup failed")
    with (
        mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": "1"}),
        pytest.raises(RuntimeError, match="warmup failed"),
    ):
        SentryHTTPServer().run()

    calls.Granian.assert_not_called()


def test_preload_reports_frozen_heap(calls: mock.Mock) -> None:
    # Workers keep sharing the warm heap only if the import froze it.
    with (
        mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": "1"}),
        mock.patch.object(gc, "get_freeze_count", return_value=680_000),
    ):
        SentryHTTPServer().run()

    calls.logger.info.assert_called_once_with(
        "granian.preload.done", extra={"target": "sentry.wsgi", "gc_frozen": 680_000}
    )


@pytest.mark.parametrize("value", ["1", "true", " Yes ", "ON"])
def test_preload_on_for_true_values(calls: mock.Mock, value: str) -> None:
    with mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": value}):
        SentryHTTPServer().run()

    calls.import_module.assert_called_once_with("sentry.wsgi")


@pytest.mark.parametrize(
    "environ",
    [{}, *({"SENTRY_GRANIAN_PRELOAD": value} for value in ("", "0", "false", "off", "anything"))],
)
def test_no_preload_unless_turned_on(calls: mock.Mock, environ: dict[str, str]) -> None:
    with mock.patch.dict(os.environ, environ):
        SentryHTTPServer().run()

    # Exactly as before: not even the start method is read.
    assert call_names(calls) == ["Granian", "Granian().serve"]
    assert calls.Granian.call_args.kwargs["target"] == "sentry.wsgi:application"


def test_preload_without_sdk_sessions(calls: mock.Mock) -> None:
    seen: list[bool | None] = []

    def import_module(name: str) -> None:
        # The SDK's WSGI middleware copies this into the warmup request's scope.
        seen.append(sentry_sdk.get_isolation_scope()._force_auto_session_tracking)

    calls.import_module.side_effect = import_module
    with mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": "1"}):
        SentryHTTPServer().run()

    assert seen == [False]
    # Workers track sessions as usual.
    assert sentry_sdk.get_isolation_scope()._force_auto_session_tracking is None


def test_preload_without_sdk_events(calls: mock.Mock) -> None:
    dropped: list[bool] = []

    def import_module(name: str) -> None:
        processors = sentry_sdk.get_isolation_scope()._event_processors
        dropped.append(processors[-1]({"message": "warmup failed"}, {}) is None)

    calls.import_module.side_effect = import_module
    processors_before = list(sentry_sdk.get_isolation_scope()._event_processors)
    with mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": "1"}):
        SentryHTTPServer().run()

    assert dropped == [True]
    # Workers report errors as usual.
    assert sentry_sdk.get_isolation_scope()._event_processors == processors_before


def test_preload_reports_threads_started_by_the_import(calls: mock.Mock) -> None:
    stop = threading.Event()

    def import_module(name: str) -> None:
        threading.Thread(target=stop.wait, name="started-by-import", daemon=True).start()

    calls.import_module.side_effect = import_module
    try:
        with mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": "1"}):
            SentryHTTPServer().run()
    finally:
        stop.set()

    calls.logger.warning.assert_called_once_with(
        "granian.preload.threads_started", extra={"threads": ["started-by-import"]}
    )
    calls.Granian.return_value.serve.assert_called_once_with()


# granian runs anything but fork or spawn as spawn.
@pytest.mark.parametrize("start_method", ["spawn", "forkserver"])
def test_no_preload_unless_workers_are_forked(calls: mock.Mock, start_method: str) -> None:
    calls.get_start_method.return_value = start_method
    with mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": "1"}):
        SentryHTTPServer().run()

    calls.import_module.assert_not_called()
    calls.connections.close_all.assert_not_called()
    calls.logger.warning.assert_called_once_with(
        "granian.preload.skipped", extra={"reason": "spawn start method"}
    )
    calls.Granian.return_value.serve.assert_called_once_with()


@pytest.mark.parametrize(
    ("default_start_method", "imports"),
    [("fork", [mock.call("sentry.wsgi")]), ("forkserver", []), ("spawn", [])],
)
def test_preload_follows_default_start_method(
    calls: mock.Mock, default_start_method: str, imports: list[object]
) -> None:
    # Nothing set the start method, so granian gets the platform default.
    calls.get_start_method.return_value = None
    with (
        mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": "1"}),
        mock.patch(
            "multiprocessing.get_all_start_methods",
            return_value=[default_start_method, "spawn"],
        ),
    ):
        SentryHTTPServer().run()

    assert calls.import_module.call_args_list == imports


def test_no_preload_with_reload(calls: mock.Mock) -> None:
    with mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": "1"}):
        SentryHTTPServer(extra_options={"reload": True}).run()

    calls.import_module.assert_not_called()
    calls.logger.warning.assert_called_once_with(
        "granian.preload.skipped", extra={"reason": "reload"}
    )
    assert calls.Granian.call_args.kwargs["reload"] is True
    calls.Granian.return_value.serve.assert_called_once_with()


# `sentry run web --debug`, or SENTRY_USE_GRANIAN = False.
@pytest.mark.parametrize(("debug", "use_granian"), [(True, True), (False, False)])
def test_no_preload_with_debug_server(calls: mock.Mock, debug: bool, use_granian: bool) -> None:
    wsgi = types.SimpleNamespace(application=mock.sentinel.application)
    with (
        mock.patch.dict(os.environ, {"SENTRY_GRANIAN_PRELOAD": "1"}),
        override_settings(SENTRY_USE_GRANIAN=use_granian),
        mock.patch.dict(sys.modules, {"sentry.wsgi": wsgi}),
        mock.patch("wsgiref.simple_server.make_server") as make_server,
        pytest.raises(AssertionError, match="unreachable"),
    ):
        SentryHTTPServer(debug=debug).run()

    make_server.assert_called_once_with(mock.ANY, mock.ANY, mock.sentinel.application)
    calls.import_module.assert_not_called()
    calls.logger.warning.assert_called_once_with(
        "granian.preload.skipped", extra={"reason": "debug server"}
    )
    calls.Granian.assert_not_called()


# A granian master with the preload and the boot GC freeze on, short of
# serving: the warmup runs (and is frozen) here, and what each forked worker
# then runs, granian's load_target, reuses it.
SUBPROCESS_TEST_PRELOAD = """
import gc
import multiprocessing
import sys
import threading
from unittest import mock

from django.db import connections
from granian._internal import load_target

from sentry.runner import configure

# Fork, whatever this platform defaults to.
multiprocessing.set_start_method("fork")
configure()
frozen_by_configure = gc.get_freeze_count()
threads_before = threading.active_count()

from sentry.services import http

with (
    mock.patch.object(http, "Granian") as granian,
    mock.patch.object(connections, "close_all", wraps=connections.close_all) as close_all,
):
    http.SentryHTTPServer().run()

granian.return_value.serve.assert_called_once_with()
wsgi = sys.modules["sentry.wsgi"]
assert gc.isenabled()
assert gc.get_freeze_count() > frozen_by_configure
assert threading.active_count() == threads_before
close_all.assert_called_once_with()

assert load_target("sentry.wsgi:application") is wsgi.application
assert sys.modules["sentry.wsgi"] is wsgi
"""


def test_preload_runs_warmup_for_forked_workers() -> None:
    env = {
        k: v
        for k, v in os.environ.items()
        if k not in ("SENTRY_GRANIAN_RELOAD", "SENTRY_GRANIAN_IFACE", "SENTRY_RUNNING_GRANIAN")
    }
    subprocess.check_call(
        [sys.executable, "-c", SUBPROCESS_TEST_PRELOAD],
        env={**env, "SENTRY_GRANIAN_PRELOAD": "1", "SENTRY_BOOT_GC_FREEZE": "1"},
    )
