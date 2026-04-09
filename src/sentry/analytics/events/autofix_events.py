from sentry import analytics


@analytics.eventclass()
class AiAutofixPhaseEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    referrer: str | None


@analytics.eventclass("ai.autofix.root_cause.started")
class AiAutofixRootCauseStartedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.solution.started")
class AiAutofixSolutionStartedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.code_changes.started")
class AiAutofixCodeChangesStartedEvent(AiAutofixPhaseEvent):
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


@analytics.eventclass("ai.autofix.impact_assessment.started")
class AiAutofixImpactAssessmentStartedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.impact_assessment.completed")
class AiAutofixImpactAssessmentCompletedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.triage.started")
class AiAutofixTriageStartedEvent(AiAutofixPhaseEvent):
    pass


@analytics.eventclass("ai.autofix.triage.completed")
class AiAutofixTriageCompletedEvent(AiAutofixPhaseEvent):
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
    initiator: str | None = None


analytics.register(AiAutofixRootCauseStartedEvent)
analytics.register(AiAutofixSolutionStartedEvent)
analytics.register(AiAutofixCodeChangesStartedEvent)
analytics.register(AiAutofixRootCauseCompletedEvent)
analytics.register(AiAutofixSolutionCompletedEvent)
analytics.register(AiAutofixCodeChangesCompletedEvent)
analytics.register(AiAutofixImpactAssessmentStartedEvent)
analytics.register(AiAutofixImpactAssessmentCompletedEvent)
analytics.register(AiAutofixTriageStartedEvent)
analytics.register(AiAutofixTriageCompletedEvent)
analytics.register(AiAutofixPrCreatedStartedEvent)
analytics.register(AiAutofixPrCreatedCompletedEvent)
analytics.register(AiAutofixAgentHandoffEvent)
