from __future__ import annotations

from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    TelemetryStatus,
    track_dynamic_sampling,
)
from sentry.testutils.helpers.options import override_options

_GATE_OPTIONS = {
    "dynamic-sampling.per_org.killswitch": False,
    "dynamic-sampling.per_org.metrics-sample-rate": 1.0,
    "dynamic-sampling.per_org.rollout-rate": 1.0,
}


@override_options(_GATE_OPTIONS)
def test_records_duration_and_reraises_with_failed_status_on_exception() -> None:
    @track_dynamic_sampling
    def boom() -> None:
        raise ValueError("nope")

    with pytest.raises(ValueError):
        boom()


@override_options(_GATE_OPTIONS)
def test_passes_result_through_and_emits_completed_on_success() -> None:
    @track_dynamic_sampling
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


@override_options(_GATE_OPTIONS)
def test_emits_returned_terminal_status_without_completed_status() -> None:
    @track_dynamic_sampling
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
