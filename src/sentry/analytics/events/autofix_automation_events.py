from sentry import analytics


@analytics.eventclass("ai.autofix.automation.generate_summary_and_run_automation")
class AiAutofixGenerateSummaryAndRunAutomationEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    issue_event_count: int
    fixability_score: float | None


@analytics.eventclass("ai.autofix.automation.generate_issue_summary_only")
class AiAutofixGenerateIssueSummaryOnlyEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    issue_event_count: int
    fixability_score: float | None


@analytics.eventclass("ai.autofix.automation.run_automation_only")
class AiAutofixRunAutomationOnlyEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    issue_event_count: int
    fixability_score: float | None


analytics.register(AiAutofixGenerateSummaryAndRunAutomationEvent)
analytics.register(AiAutofixGenerateIssueSummaryOnlyEvent)
analytics.register(AiAutofixRunAutomationOnlyEvent)
