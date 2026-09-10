from sentry import analytics
from sentry.analytics.events.autofix_events import AiAutofixPhaseEvent
from sentry.utils import metrics


def record_funnel_event(event: AiAutofixPhaseEvent) -> None:
    """Record an Autofix funnel event in BigQuery and Datadog."""
    analytics.record(event)
    if event.type is not None:
        metrics.incr(event.type)
