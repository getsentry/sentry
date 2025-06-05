from sentry import analytics


@analytics.eventclass("manual.issue_assignment")
class ManualIssueAssignment(analytics.Event):
    organization_id: str
    project_id: str
    group_id: str
    assigned_by: str | None = None
    had_to_deassign: str | None = None


analytics.register(ManualIssueAssignment)
