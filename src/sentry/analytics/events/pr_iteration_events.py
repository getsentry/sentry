from sentry import analytics


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

    # Outcome, written when the iteration ends. ``outcome`` is a plain str
    # rather than a Literal: its failure values are Seer's own, so a reason Seer
    # adds mid-deploy still records instead of failing validation. See
    # ``PrIterationOutcome`` for the values Sentry knows about.
    duration_ms: int
    outcome: str


analytics.register(AiAutofixPrIterationFeedbackBatchCompletedEvent)
