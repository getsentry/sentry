from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    duration_metric_for,
    emit_status_metric,
    instrumented,
    status_metric_for,
)


@pytest.fixture(autouse=True)
def _stub_metrics_sample_rate() -> Iterator[None]:
    """Keep these unit tests DB-free.

    The decorator's real ``timed`` path calls ``metrics_sample_rate()``, which
    reads an option out of the DB. Stubbing it here means tests that don't
    explicitly patch ``timed`` still never hit the DB.
    """

    with patch(
        "sentry.dynamic_sampling.per_org.tasks.telemetry.metrics_sample_rate",
        return_value=1.0,
    ):
        yield


class _BoomError(RuntimeError):
    pass


def test_metric_names_are_derived_from_function_name() -> None:
    assert status_metric_for("run_calculations_per_org") == (
        "dynamic_sampling.run_calculations_per_org.status"
    )
    assert duration_metric_for("run_calculations_per_org") == (
        "dynamic_sampling.run_calculations_per_org.duration"
    )


def test_records_duration_and_reraises_with_failed_status_on_exception() -> None:
    @instrumented
    def boom() -> None:
        raise _BoomError("nope")

    with (
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.timed") as timed_cm,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.sentry_sdk") as sdk,
    ):
        with pytest.raises(_BoomError):
            boom()

    timed_cm.assert_called_once_with("dynamic_sampling.boom.duration")
    emit.assert_called_once_with("dynamic_sampling.boom.status", "failed")
    assert sdk.capture_exception.call_count == 1
    (captured_exc,), _ = sdk.capture_exception.call_args
    assert isinstance(captured_exc, _BoomError)


def test_passes_result_through_on_success_without_emitting_failed() -> None:
    @instrumented
    def add(x: int, y: int) -> int:
        return x + y

    with (
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.timed") as timed_cm,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.sentry_sdk") as sdk,
    ):
        assert add(2, 3) == 5

    timed_cm.assert_called_once_with("dynamic_sampling.add.duration")
    emit.assert_not_called()
    sdk.capture_exception.assert_not_called()


def test_emit_status_metric_routes_to_enclosing_function() -> None:
    @instrumented
    def orch() -> None:
        emit_status_metric("killswitched")

    with patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit:
        orch()

    emit.assert_called_once_with("dynamic_sampling.orch.status", "killswitched", extra_tags=None)


def test_emit_status_metric_outside_decorated_function_raises() -> None:
    with pytest.raises(RuntimeError):
        emit_status_metric("anything")


def test_emit_status_metric_resolves_to_nearest_enclosing_function() -> None:
    calls: list[tuple[str, str]] = []

    def _record(metric: str, status: str, *, extra_tags=None) -> None:
        calls.append((metric, status))

    @instrumented
    def inner() -> None:
        emit_status_metric("nested")

    @instrumented
    def outer() -> None:
        emit_status_metric("before")
        inner()
        emit_status_metric("after")

    with patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status", side_effect=_record):
        outer()

    assert calls == [
        ("dynamic_sampling.outer.status", "before"),
        ("dynamic_sampling.inner.status", "nested"),
        ("dynamic_sampling.outer.status", "after"),
    ]


def test_preserves_wrapped_function_metadata() -> None:
    @instrumented
    def documented(x: int) -> int:
        """some docstring"""
        return x

    assert documented.__name__ == "documented"
    assert documented.__doc__ == "some docstring"
