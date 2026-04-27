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
    """Keep these unit tests DB-free.

    The decorator's timer path calls ``metrics_sample_rate()``, which
    reads an option out of the DB. Stubbing it here means tests that don't
    explicitly patch ``metrics.timer`` still never hit the DB.
    """

    with patch(
        "sentry.dynamic_sampling.per_org.tasks.telemetry.metrics_sample_rate",
        return_value=1.0,
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
