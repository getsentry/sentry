import logging

from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.autofix.pr_iteration.check_suites import resolve_check_suite

logger = logging.getLogger(__name__)


def handle_pr_iteration_check_suite(check_suite_event: CheckSuiteEvent) -> None:
    """Meat of check-suite handling: green undraft/review or red→iterate.

    Intended to run on a longer-deadline task after the listener has already
    gated relevance. The raw event is what crosses the task boundary, so this
    resolves it again rather than carrying resolved state.
    """
    resolved = resolve_check_suite(check_suite_event)
    if resolved is None:
        return None

    resolved.handle()
    return None


@scm_event_stream.listen_for(event_type="check_suite")
def pr_iteration_from_check_suite_listener(check_suite_event: CheckSuiteEvent):
    """SCM stream entry (10s deadline): relevance guard, then queue the meat."""
    resolved = resolve_check_suite(check_suite_event)
    if resolved is None or not resolved.is_relevant():
        return None

    # Lazy: tasks.seer.pr_iteration pulls SCM/GitHub clients that need options.
    from sentry.tasks.seer.pr_iteration import process_pr_iteration_check_suite

    process_pr_iteration_check_suite.delay(
        subscription_event=dict(check_suite_event.subscription_event),
    )
    return None
