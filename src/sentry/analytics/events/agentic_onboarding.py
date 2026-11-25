from dataclasses import field

from sentry import analytics


@analytics.eventclass("agentic_onboarding.stage_completed")
class AgenticOnboardingStageCompletedEvent(analytics.Event):
    user_id: int
    organization_id: int
    run_id: str
    origin: str | None
    stage: str
    status: str
    connection_method: str | None = None
    # The projects the agent reported for the run's create_project stage.
    project_slugs: list[str] = field(default_factory=list)


@analytics.eventclass("agentic_onboarding.stage_status_changed")
class AgenticOnboardingStageStatusChangedEvent(analytics.Event):
    user_id: int
    organization_id: int
    run_id: str
    origin: str | None
    stage: str
    status: str
    connection_method: str | None = None
    # The projects the agent reported for the run's create_project stage.
    project_slugs: list[str] = field(default_factory=list)


@analytics.eventclass("agentic_onboarding.run_completed")
class AgenticOnboardingRunCompletedEvent(analytics.Event):
    user_id: int
    organization_id: int
    run_id: str
    origin: str | None
    status: str
    connection_method: str | None = None
    # The projects the agent reported for the run's create_project stage.
    project_slugs: list[str] = field(default_factory=list)


analytics.register(AgenticOnboardingStageCompletedEvent)
analytics.register(AgenticOnboardingStageStatusChangedEvent)
analytics.register(AgenticOnboardingRunCompletedEvent)
