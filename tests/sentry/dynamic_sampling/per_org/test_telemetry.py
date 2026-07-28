from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.per_org.telemetry import (
    DynamicSamplingException,
    DynamicSamplingStatus,
    track_dynamic_sampling,
)
from sentry.testutils.helpers.options import override_options
from sentry.utils.snuba_rpc import SnubaRPCError, SnubaRPCTimeout

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
    error = ValueError("nope")

    @track_dynamic_sampling
    def boom() -> None:
        raise error

    timer, timer_tags = _capture_timer_tags()

    with (
        patch("sentry.dynamic_sampling.per_org.telemetry.metrics") as mock_metrics,
        patch("sentry.dynamic_sampling.per_org.telemetry.emit_status") as emit,
        pytest.raises(ValueError),
    ):
        mock_metrics.timer.side_effect = timer
        boom()

    assert timer_tags["status"] == DynamicSamplingStatus.FAILED.value
    emit.assert_called_once_with("dynamic_sampling.boom.status", DynamicSamplingStatus.FAILED)


@override_options(_GATE_OPTIONS)
def test_reraises_snuba_timeout_and_emits_timeout_status() -> None:
    error = SnubaRPCTimeout("timed out")

    @track_dynamic_sampling
    def boom() -> None:
        raise error

    timer, timer_tags = _capture_timer_tags()

    with (
        patch("sentry.dynamic_sampling.per_org.telemetry.metrics") as mock_metrics,
        patch("sentry.dynamic_sampling.per_org.telemetry.emit_status") as emit,
        pytest.raises(SnubaRPCTimeout),
    ):
        mock_metrics.timer.side_effect = timer
        boom()

    assert timer_tags["status"] == DynamicSamplingStatus.FAILED.value
    emit.assert_called_once_with(
        "dynamic_sampling.boom.status", DynamicSamplingStatus.SNUBA_TIMEOUT
    )


@override_options(_GATE_OPTIONS)
def test_reraises_snuba_error_and_emits_snuba_error_status() -> None:
    error = SnubaRPCError("snuba failed")

    @track_dynamic_sampling
    def boom() -> None:
        raise error

    timer, timer_tags = _capture_timer_tags()

    with (
        patch("sentry.dynamic_sampling.per_org.telemetry.metrics") as mock_metrics,
        patch("sentry.dynamic_sampling.per_org.telemetry.emit_status") as emit,
        pytest.raises(SnubaRPCError),
    ):
        mock_metrics.timer.side_effect = timer
        boom()

    assert timer_tags["status"] == DynamicSamplingStatus.FAILED.value
    emit.assert_called_once_with("dynamic_sampling.boom.status", DynamicSamplingStatus.SNUBA_ERROR)


@override_options(_GATE_OPTIONS)
def test_passes_result_through_and_emits_completed_on_success() -> None:
    @track_dynamic_sampling
    def add(x: int, y: int) -> int:
        return x + y

    timer, timer_tags = _capture_timer_tags()
    with (
        patch("sentry.dynamic_sampling.per_org.telemetry.metrics") as mock_metrics,
        patch("sentry.dynamic_sampling.per_org.telemetry.emit_status") as emit,
    ):
        mock_metrics.timer.side_effect = timer
        assert add(2, 3) == 5

    mock_metrics.timer.assert_called_once_with("dynamic_sampling.add.duration", sample_rate=1.0)
    assert timer_tags["status"] == DynamicSamplingStatus.COMPLETED.value
    emit.assert_called_once_with("dynamic_sampling.add.status", DynamicSamplingStatus.COMPLETED)


@override_options(_GATE_OPTIONS)
def test_emits_returned_terminal_status_without_completed_status() -> None:
    @track_dynamic_sampling
    def skipped() -> DynamicSamplingStatus:
        return DynamicSamplingStatus.NOT_IN_ROLLOUT

    timer, timer_tags = _capture_timer_tags()
    with (
        patch("sentry.dynamic_sampling.per_org.telemetry.metrics") as mock_metrics,
        patch("sentry.dynamic_sampling.per_org.telemetry.emit_status") as emit,
    ):
        mock_metrics.timer.side_effect = timer
        assert skipped() == DynamicSamplingStatus.NOT_IN_ROLLOUT

    mock_metrics.timer.assert_called_once_with("dynamic_sampling.skipped.duration", sample_rate=1.0)
    assert timer_tags["status"] == DynamicSamplingStatus.NOT_IN_ROLLOUT.value
    emit.assert_called_once_with(
        "dynamic_sampling.skipped.status", DynamicSamplingStatus.NOT_IN_ROLLOUT
    )


@override_options(_GATE_OPTIONS)
def test_emits_terminal_status_exception_without_failed_status() -> None:
    @track_dynamic_sampling
    def skipped() -> None:
        raise DynamicSamplingException(DynamicSamplingStatus.NO_SUBSCRIPTION)

    timer, timer_tags = _capture_timer_tags()
    with (
        patch("sentry.dynamic_sampling.per_org.telemetry.metrics") as mock_metrics,
        patch("sentry.dynamic_sampling.per_org.telemetry.emit_status") as emit,
    ):
        mock_metrics.timer.side_effect = timer
        assert skipped() == DynamicSamplingStatus.NO_SUBSCRIPTION

    mock_metrics.timer.assert_called_once_with("dynamic_sampling.skipped.duration", sample_rate=1.0)
    assert timer_tags["status"] == DynamicSamplingStatus.NO_SUBSCRIPTION.value
    emit.assert_called_once_with(
        "dynamic_sampling.skipped.status", DynamicSamplingStatus.NO_SUBSCRIPTION
    )
