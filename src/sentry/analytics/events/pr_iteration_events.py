from typing import Literal

from sentry import analytics


@analytics.eventclass("ai.autofix.pr_iteration.missing_permissions")
class AiAutofixPrIterationMissingPermissionsEvent(analytics.Event):
    """A missing-permissions warning was shown, or the app was updated.

    IDs only — no slugs or names. ``repository_id`` is set when we posted a
    comment on a specific repo; it is None on ``permissions_accepted`` because
    GitHub App permissions are installation-wide.
    """

    action: Literal["comment_posted", "permissions_accepted"]
    organization_id: int
    integration_id: int
    repository_id: int | None = None


@analytics.eventclass("ai.autofix.pr_iteration.feedback_batch.completed")
class AiAutofixPrIterationFeedbackBatchCompletedEvent(analytics.Event):
    """One batch of PR feedback turned into one agent run, emitted when it ends.

    Accumulated on a ``SeerRunPrIteration`` row from the first queued feedback
    item and flushed here. An iteration that never reaches its completion hook
    is not recorded.
    """

    iteration_id: int

    organization_id: int
    project_id: int
    group_id: int
    run_id: int
    referrer: str | None
    iteration_index: int

    # Queue counts, written by the drain.
    feedback_count: int
    queued_count: int
    dropped_count: int
    automated_feedback_count: int

    # Outcome, written when the iteration ends.
    duration_ms: int
    pushed_changes: bool


analytics.register(AiAutofixPrIterationMissingPermissionsEvent)
analytics.register(AiAutofixPrIterationFeedbackBatchCompletedEvent)
