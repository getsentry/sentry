from sentry import analytics


@analytics.eventclass("issueowners.assignment")
class IssueOwnersAssignment(analytics.Event):
    organization_id: str
    project_id: str
    group_id: str
    updated_assignment: str


analytics.register(IssueOwnersAssignment)
