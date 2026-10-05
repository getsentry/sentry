from sentry import analytics
from sentry.analytics.events.autofix_events import AiAutofixPhaseEvent
from sentry.utils import metrics


def record_autofix_event(event: AiAutofixPhaseEvent) -> None:
    """Record an Autofix funnel event in BigQuery, Datadog, and Sentry Metrics."""
    analytics.record(event)
    if event.type is not None:
        metrics.incr(event.type, sample_rate=1.0)
