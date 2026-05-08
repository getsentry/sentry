from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    DynamicSamplingException,
    TelemetryStatus,
    track_dynamic_sampling,
)
from sentry.testutils.helpers.options import override_options

_GATE_OPTIONS = {
    "dynamic-sampling.per_org.killswitch": False,
    "dynamic-sampling.per_org.metrics-sample-rate": 1.0,
    "dynamic-sampling.per_org.rollout-rate": 1.0,
}


def _capture_timer_tags() -> tuple[object, dict[str, str]]:
    tags: dict[str, str] = {}

    @contextmanager
    def timer(*args: object, **kwargs: object):
        yield tags

    return timer, tags


@override_options(_GATE_OPTIONS)
def test_records_duration_and_reraises_with_failed_status_on_exception() -> None:
    @track_dynamic_sampling
    def boom() -> None:
        raise ValueError("nope")

    timer, timer_tags = _capture_timer_tags()

    with (
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.metrics.timer", side_effect=timer),
        pytest.raises(ValueError),
    ):
        boom()

    assert timer_tags["status"] == TelemetryStatus.FAILED.value


@override_options(_GATE_OPTIONS)
def test_passes_result_through_and_emits_completed_on_success() -> None:
    @track_dynamic_sampling
    def add(x: int, y: int) -> int:
        return x + y

    timer, timer_tags = _capture_timer_tags()
    with (
        patch(
            "sentry.dynamic_sampling.per_org.tasks.telemetry.metrics.timer", side_effect=timer
        ) as timer_mock,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.sentry_sdk") as sdk,
    ):
        assert add(2, 3) == 5

    timer_mock.assert_called_once_with("dynamic_sampling.add.duration", sample_rate=1.0)
    assert timer_tags["status"] == TelemetryStatus.COMPLETED.value
    emit.assert_called_once_with("dynamic_sampling.add.status", TelemetryStatus.COMPLETED)
    sdk.capture_exception.assert_not_called()


@override_options(_GATE_OPTIONS)
def test_emits_returned_terminal_status_without_completed_status() -> None:
    @track_dynamic_sampling
    def skipped() -> TelemetryStatus:
        return TelemetryStatus.NOT_IN_ROLLOUT

    timer, timer_tags = _capture_timer_tags()
    with (
        patch(
            "sentry.dynamic_sampling.per_org.tasks.telemetry.metrics.timer", side_effect=timer
        ) as timer_mock,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.sentry_sdk") as sdk,
    ):
        assert skipped() == TelemetryStatus.NOT_IN_ROLLOUT

    timer_mock.assert_called_once_with("dynamic_sampling.skipped.duration", sample_rate=1.0)
    assert timer_tags["status"] == TelemetryStatus.NOT_IN_ROLLOUT.value
    emit.assert_called_once_with("dynamic_sampling.skipped.status", TelemetryStatus.NOT_IN_ROLLOUT)
    sdk.capture_exception.assert_not_called()


@override_options(_GATE_OPTIONS)
def test_emits_terminal_status_exception_without_failed_status() -> None:
    @track_dynamic_sampling
    def skipped() -> None:
        raise DynamicSamplingException(TelemetryStatus.NO_SUBSCRIPTION)

    timer, timer_tags = _capture_timer_tags()
    with (
        patch(
            "sentry.dynamic_sampling.per_org.tasks.telemetry.metrics.timer", side_effect=timer
        ) as timer_mock,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit,
        patch("sentry.dynamic_sampling.per_org.tasks.telemetry.sentry_sdk") as sdk,
    ):
        assert skipped() == TelemetryStatus.NO_SUBSCRIPTION

    timer_mock.assert_called_once_with("dynamic_sampling.skipped.duration", sample_rate=1.0)
    assert timer_tags["status"] == TelemetryStatus.NO_SUBSCRIPTION.value
    emit.assert_called_once_with("dynamic_sampling.skipped.status", TelemetryStatus.NO_SUBSCRIPTION)
    sdk.capture_exception.assert_not_called()
