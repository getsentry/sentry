from __future__ import annotations

import pytest

from sentry.dynamic_sampling.per_org.telemetry import (
    DynamicSamplingException,
    DynamicSamplingStatus,
    track_dynamic_sampling,
)
from sentry.testutils.helpers.options import override_options
from sentry.utils.snuba_rpc import SnubaRPCError, SnubaRPCTimeout

# The metrics sample rate is overridden only so emitting a metric does not read the
# option from the database; none of these tests assert on the emitted metrics.
_GATE_OPTIONS = {
    "dynamic-sampling.per_org.killswitch": False,
    "dynamic-sampling.per_org.metrics-sample-rate": 1.0,
    "dynamic-sampling.per_org.rollout-rate": 1.0,
}


@override_options(_GATE_OPTIONS)
def test_reraises_exception() -> None:
    @track_dynamic_sampling
    def boom() -> None:
        raise ValueError("nope")

    with pytest.raises(ValueError):
        boom()


@override_options(_GATE_OPTIONS)
def test_reraises_snuba_timeout() -> None:
    @track_dynamic_sampling
    def boom() -> None:
        raise SnubaRPCTimeout("timed out")

    with pytest.raises(SnubaRPCTimeout):
        boom()


@override_options(_GATE_OPTIONS)
def test_reraises_snuba_error() -> None:
    @track_dynamic_sampling
    def boom() -> None:
        raise SnubaRPCError("snuba failed")

    with pytest.raises(SnubaRPCError):
        boom()


@override_options(_GATE_OPTIONS)
def test_passes_result_through() -> None:
    @track_dynamic_sampling
    def add(x: int, y: int) -> int:
        return x + y

    assert add(2, 3) == 5


@override_options(_GATE_OPTIONS)
def test_returns_terminal_status_unchanged() -> None:
    @track_dynamic_sampling
    def skipped() -> DynamicSamplingStatus:
        return DynamicSamplingStatus.NOT_IN_ROLLOUT

    assert skipped() == DynamicSamplingStatus.NOT_IN_ROLLOUT


@override_options(_GATE_OPTIONS)
def test_terminal_status_exception_becomes_return_value() -> None:
    @track_dynamic_sampling
    def skipped() -> None:
        raise DynamicSamplingException(DynamicSamplingStatus.NO_SUBSCRIPTION)

    assert skipped() == DynamicSamplingStatus.NO_SUBSCRIPTION


@override_options({**_GATE_OPTIONS, "dynamic-sampling.per_org.killswitch": True})
def test_killswitch_skips_the_wrapped_function() -> None:
    calls: list[None] = []

    @track_dynamic_sampling
    def work() -> str:
        calls.append(None)
        return "ran"

    assert work() == DynamicSamplingStatus.KILLSWITCHED
    assert calls == []


@override_options({**_GATE_OPTIONS, "dynamic-sampling.per_org.rollout-rate": 0.0})
def test_disabled_rollout_skips_the_wrapped_function() -> None:
    calls: list[None] = []

    @track_dynamic_sampling
    def work() -> str:
        calls.append(None)
        return "ran"

    assert work() == DynamicSamplingStatus.ROLLOUT_DISABLED
    assert calls == []
