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


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        (ValueError("nope"), DynamicSamplingStatus.FAILED),
        (SnubaRPCTimeout("timed out"), DynamicSamplingStatus.SNUBA_TIMEOUT),
        (SnubaRPCError("snuba failed"), DynamicSamplingStatus.SNUBA_ERROR),
    ],
)
@override_options(_GATE_OPTIONS)
def test_reraises_and_emits_error_status(
    error: Exception, expected_status: DynamicSamplingStatus
) -> None:
    @track_dynamic_sampling
    def boom() -> None:
        raise error

    timer, timer_tags = _capture_timer_tags()

    with (
        patch("sentry.dynamic_sampling.per_org.telemetry.metrics") as mock_metrics,
        patch("sentry.dynamic_sampling.per_org.telemetry.emit_status") as emit,
        pytest.raises(type(error)),
    ):
        mock_metrics.timer.side_effect = timer
        boom()

    assert timer_tags["status"] == DynamicSamplingStatus.FAILED.value
    emit.assert_called_once_with("dynamic_sampling.boom.status", expected_status)


@pytest.mark.parametrize(
    ("gate_overrides", "expected_status"),
    [
        ({"dynamic-sampling.per_org.killswitch": True}, DynamicSamplingStatus.KILLSWITCHED),
        ({"dynamic-sampling.per_org.rollout-rate": 0.0}, DynamicSamplingStatus.ROLLOUT_DISABLED),
    ],
)
def test_gate_short_circuits_without_calling_function(
    gate_overrides: dict[str, object], expected_status: DynamicSamplingStatus
) -> None:
    calls = []

    @track_dynamic_sampling
    def gated() -> None:
        calls.append(1)

    timer, timer_tags = _capture_timer_tags()
    with (
        override_options({**_GATE_OPTIONS, **gate_overrides}),
        patch("sentry.dynamic_sampling.per_org.telemetry.metrics") as mock_metrics,
        patch("sentry.dynamic_sampling.per_org.telemetry.emit_status") as emit,
    ):
        mock_metrics.timer.side_effect = timer
        assert gated() == expected_status

    assert calls == []
    assert timer_tags["status"] == expected_status.value
    emit.assert_called_once_with("dynamic_sampling.gated.status", expected_status)


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
