from collections.abc import Generator
from contextlib import contextmanager
from unittest import mock

from taskbroker_client.app import TaskbrokerApp

from sentry.taskworker import runtime


def test_load_modules_runs_inside_the_gc_window() -> None:
    events: list[object] = []

    @contextmanager
    def fake_window(point: str) -> Generator[None]:
        events.append(("enter", point))
        yield
        events.append(("exit", point))

    with (
        mock.patch.object(runtime, "frozen_after_boot", fake_window),
        mock.patch.object(
            TaskbrokerApp, "load_modules", side_effect=lambda: events.append("load_modules")
        ),
    ):
        runtime.app.load_modules()

    assert events == [
        ("enter", "taskworker_load_modules"),
        "load_modules",
        ("exit", "taskworker_load_modules"),
    ]
