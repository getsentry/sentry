from sentry import analytics


@analytics.eventclass("agentic_onboarding.stage_completed")
class AgenticOnboardingStageCompletedEvent(analytics.Event):
    user_id: int
    organization_id: int
    run_id: str
    stage: str
    status: str


analytics.register(AgenticOnboardingStageCompletedEvent)
