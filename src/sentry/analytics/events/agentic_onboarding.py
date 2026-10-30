from sentry import analytics


@analytics.eventclass("agentic_onboarding.stage_completed")
class AgenticOnboardingStageCompletedEvent(analytics.Event):
    user_id: int
    organization_id: int
    run_id: str
    stage: str
    status: str
    origin: str | None = None


@analytics.eventclass("agentic_onboarding.stage_status_changed")
class AgenticOnboardingStageStatusChangedEvent(analytics.Event):
    user_id: int
    organization_id: int
    run_id: str
    stage: str
    status: str
    origin: str | None = None


@analytics.eventclass("agentic_onboarding.run_completed")
class AgenticOnboardingRunCompletedEvent(analytics.Event):
    user_id: int
    organization_id: int
    run_id: str
    status: str
    origin: str | None = None


analytics.register(AgenticOnboardingStageCompletedEvent)
analytics.register(AgenticOnboardingStageStatusChangedEvent)
analytics.register(AgenticOnboardingRunCompletedEvent)
