"""Central metrics emitters for the per-org dynamic sampling pipeline.

Every metric emitted by the scheduler, the bucket fan-out, or the per-org
orchestrator goes through these helpers so that:

* the sample rate is read from a single option (``metrics_sample_rate``),
* the ``status`` tag convention is applied uniformly, and
* there is one place to change if the emission shape needs to evolve.
"""

from __future__ import annotations

from collections.abc import Generator, Mapping
from contextlib import contextmanager

from sentry.dynamic_sampling.per_org.tasks.gate import metrics_sample_rate
from sentry.utils import metrics

ORCHESTRATOR_STATUS_METRIC = "dynamic_sampling.run_calculations_per_org.status"
ORCHESTRATOR_DURATION_METRIC = "dynamic_sampling.run_calculations_per_org.duration"

SCHEDULER_BEAT_STATUS_METRIC = "dynamic_sampling.schedule_per_org_calculations.status"
SCHEDULER_BUCKET_STATUS_METRIC = "dynamic_sampling.schedule_per_org_calculations_bucket.status"
SCHEDULER_BUCKET_ORG_STATUS_METRIC = (
    "dynamic_sampling.schedule_per_org_calculations_bucket.org_status"
)
SCHEDULER_BUCKET_SIZE_METRIC = "dynamic_sampling.schedule_per_org_calculations_bucket.bucket_size"


def _merge_tags(status: str, extra: Mapping[str, str] | None) -> dict[str, str]:
    tags: dict[str, str] = {"status": status}
    if extra:
        tags.update(extra)
    return tags


def emit_status(
    metric: str,
    status: str,
    *,
    amount: int = 1,
    extra_tags: Mapping[str, str] | None = None,
) -> None:
    """Emit a counter with a ``status`` tag, sampled by the pipeline option."""
    metrics.incr(
        metric,
        amount=amount,
        sample_rate=metrics_sample_rate(),
        tags=_merge_tags(status, extra_tags),
    )


def emit_gauge(metric: str, value: float, *, tags: Mapping[str, str] | None = None) -> None:
    """Emit a gauge sampled by the pipeline option."""
    metrics.gauge(
        metric,
        value,
        sample_rate=metrics_sample_rate(),
        tags=dict(tags) if tags else None,
    )


@contextmanager
def timed(metric: str) -> Generator[None]:
    """Time a block with the pipeline's sample rate applied."""
    with metrics.timer(metric, sample_rate=metrics_sample_rate()):
        yield
