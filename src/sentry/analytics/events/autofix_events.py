from sentry import analytics


@analytics.eventclass()
class AiAutofixPhaseEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    referrer: str | None
    iteration_index: int | None = None
    pr_iteration_enabled: bool | None = None


@analytics.eventclass("ai.autofix.root_cause.started")
class AiAutofixRootCauseStartedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.solution.started")
class AiAutofixSolutionStartedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.code_changes.started")
class AiAutofixCodeChangesStartedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.pr_iteration.started")
class AiAutofixIterationStartedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.root_cause.completed")
class AiAutofixRootCauseCompletedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.solution.completed")
class AiAutofixSolutionCompletedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.code_changes.completed")
class AiAutofixCodeChangesCompletedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.pr_iteration.completed")
class AiAutofixIterationCompletedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.pr_created.started")
class AiAutofixPrCreatedStartedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.pr_created.completed")
class AiAutofixPrCreatedCompletedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.agent_handoff")
class AiAutofixAgentHandoffEvent(AiAutofixPhaseEvent):
    coding_agent: str | None


@analytics.eventclass("ai.autofix.introspection")
class AiAutofixIntrospectionEvent(AiAutofixPhaseEvent):
    step: str
    action: str
    reached_stopping_point: bool


analytics.register(AiAutofixRootCauseStartedEvent)
analytics.register(AiAutofixSolutionStartedEvent)
analytics.register(AiAutofixCodeChangesStartedEvent)
analytics.register(AiAutofixIterationStartedEvent)
analytics.register(AiAutofixRootCauseCompletedEvent)
analytics.register(AiAutofixSolutionCompletedEvent)
analytics.register(AiAutofixCodeChangesCompletedEvent)
analytics.register(AiAutofixIterationCompletedEvent)
analytics.register(AiAutofixPrCreatedStartedEvent)
analytics.register(AiAutofixPrCreatedCompletedEvent)
analytics.register(AiAutofixAgentHandoffEvent)
analytics.register(AiAutofixIntrospectionEvent)
