from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    TelemetryStatus,
    emit_status,
    instrumented,
)


@pytest.fixture(autouse=True)
def _stub_metrics_sample_rate() -> Iterator[None]:
    with (
        patch(
            "sentry.dynamic_sampling.per_org.tasks.telemetry.metrics_sample_rate",
            return_value=1.0,
        ),
        patch(
            "sentry.dynamic_sampling.per_org.tasks.telemetry.is_killswitch_engaged",
            return_value=False,
        ),
        patch(
            "sentry.dynamic_sampling.per_org.tasks.telemetry.is_rollout_enabled",
            return_value=True,
        ),
    ):
        yield


class _BoomError(RuntimeError):
    pass


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
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.metrics.timer") as timer,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.sentry_sdk") as sdk,
    ):
        with pytest.raises(_BoomError):
            boom()

    timer.assert_called_once_with("dynamic_sampling.boom.duration", sample_rate=1.0)
    emit.assert_called_once_with("dynamic_sampling.boom.status", TelemetryStatus.FAILED)
    assert sdk.capture_exception.call_count == 1
    (captured_exc,), _ = sdk.capture_exception.call_args
    assert isinstance(captured_exc, _BoomError)


def test_passes_result_through_and_emits_completed_on_success() -> None:
    @instrumented
    def add(x: int, y: int) -> int:
        return x + y

    with (
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.metrics.timer") as timer,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.sentry_sdk") as sdk,
    ):
        assert add(2, 3) == 5

    timer.assert_called_once_with("dynamic_sampling.add.duration", sample_rate=1.0)
    emit.assert_called_once_with("dynamic_sampling.add.status", TelemetryStatus.COMPLETED)
    sdk.capture_exception.assert_not_called()


def test_emits_returned_terminal_status_without_completed_status() -> None:
    @instrumented
    def skipped() -> TelemetryStatus:
        return TelemetryStatus.NOT_IN_ROLLOUT

    with (
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.metrics.timer") as timer,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.sentry_sdk") as sdk,
    ):
        assert skipped() == TelemetryStatus.NOT_IN_ROLLOUT

    timer.assert_called_once_with("dynamic_sampling.skipped.duration", sample_rate=1.0)
    emit.assert_called_once_with("dynamic_sampling.skipped.status", TelemetryStatus.NOT_IN_ROLLOUT)
    sdk.capture_exception.assert_not_called()


def test_killswitch_short_circuits_function() -> None:
    called = False

    @instrumented
    def skipped() -> None:
        nonlocal called
        called = True

    with (
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.metrics.timer") as timer,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit,
        patch(
            "sentry.dynamic_sampling.per_org.tasks.telemetry.is_killswitch_engaged",
            return_value=True,
        ),
    ):
        assert skipped() == TelemetryStatus.KILLSWITCHED

    assert not called
    timer.assert_called_once_with("dynamic_sampling.skipped.duration", sample_rate=1.0)
    emit.assert_called_once_with("dynamic_sampling.skipped.status", TelemetryStatus.KILLSWITCHED)


def test_rollout_disabled_short_circuits_function() -> None:
    called = False

    @instrumented
    def skipped() -> None:
        nonlocal called
        called = True

    with (
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.metrics.timer") as timer,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit,
        patch(
            "sentry.dynamic_sampling.per_org.tasks.telemetry.is_rollout_enabled", return_value=False
        ),
    ):
        assert skipped() == TelemetryStatus.ROLLOUT_DISABLED

    assert not called
    timer.assert_called_once_with("dynamic_sampling.skipped.duration", sample_rate=1.0)
    emit.assert_called_once_with(
        "dynamic_sampling.skipped.status", TelemetryStatus.ROLLOUT_DISABLED
    )
