from typing import int
from sentry import analytics


@analytics.eventclass("manual.issue_assignment")
class ManualIssueAssignment(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    assigned_by: str | None = None
    had_to_deassign: bool | None = None


analytics.register(ManualIssueAssignment)
