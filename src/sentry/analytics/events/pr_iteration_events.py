from sentry import analytics


@analytics.eventclass("ai.autofix.pr_iteration.details.completed")
class AiAutofixPrIterationDetailsCompletedEvent(analytics.Event):
    """One iteration of the automated PR-iteration flow, emitted when it ends.

    Buffered on the run from the first queued feedback item and flushed here, so
    everything an iteration learns lands on one row. Only an iteration that
    reaches its completion hook is recorded; the ways one can end without
    getting there are not events yet.
    """

    # The ``SeerRunPrIteration`` row this was accumulated on; ties the row to the
    # agent run that did the work, since it rides the iteration's memory-block
    # metadata.
    iteration_id: int

    organization_id: int
    project_id: int
    group_id: int
    run_id: int


analytics.register(AiAutofixPrIterationDetailsCompletedEvent)
