from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    TelemetryStatus,
    duration_metric_for,
    emit_status,
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


def test_emit_status_adds_string_status_tag() -> None:
    with patch("sentry.dynamic_sampling.per_org.tasks.telemetry.metrics") as metrics:
        emit_status(
            "dynamic_sampling.test.status",
            TelemetryStatus.ROLLOUT_DISABLED,
            extra_tags={"bucket_index": "1"},
        )

    metrics.incr.assert_called_once_with(
        "dynamic_sampling.test.status",
        amount=1,
        sample_rate=1.0,
        tags={"status": "rollout_disabled", "bucket_index": "1"},
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
    emit.assert_called_once_with("dynamic_sampling.boom.status", TelemetryStatus.FAILED)
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
        emit_status_metric(TelemetryStatus.KILLSWITCHED)

    with patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit:
        orch()

    emit.assert_called_once_with(
        "dynamic_sampling.orch.status", TelemetryStatus.KILLSWITCHED, extra_tags=None
    )


def test_emit_status_metric_outside_decorated_function_raises() -> None:
    with pytest.raises(RuntimeError):
        emit_status_metric(TelemetryStatus.COMPLETED)


def test_emit_status_metric_resolves_to_nearest_enclosing_function() -> None:
    calls: list[tuple[str, TelemetryStatus]] = []

    def _record(metric: str, status: TelemetryStatus, *, extra_tags=None) -> None:
        calls.append((metric, status))

    @instrumented
    def inner() -> None:
        emit_status_metric(TelemetryStatus.NO_VOLUME)

    @instrumented
    def outer() -> None:
        emit_status_metric(TelemetryStatus.NOT_IN_ROLLOUT)
        inner()
        emit_status_metric(TelemetryStatus.COMPLETED)

    with patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status", side_effect=_record):
        outer()

    assert calls == [
        ("dynamic_sampling.outer.status", TelemetryStatus.NOT_IN_ROLLOUT),
        ("dynamic_sampling.inner.status", TelemetryStatus.NO_VOLUME),
        ("dynamic_sampling.outer.status", TelemetryStatus.COMPLETED),
    ]


def test_preserves_wrapped_function_metadata() -> None:
    @instrumented
    def documented(x: int) -> int:
        """some docstring"""
        return x

    assert documented.__name__ == "documented"
    assert documented.__doc__ == "some docstring"
