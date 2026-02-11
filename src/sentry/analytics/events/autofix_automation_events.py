from sentry import analytics


@analytics.eventclass("ai.autofix.automation")
class AiAutofixAutomationEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    task_name: str
    issue_event_count: int
    fixability_score: float | None


analytics.register(AiAutofixAutomationEvent)


@analytics.eventclass("ai.autofix.drawer_viewed")
class AiAutofixDrawerViewedEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int


analytics.register(AiAutofixDrawerViewedEvent)
