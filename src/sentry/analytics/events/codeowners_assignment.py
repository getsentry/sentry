from sentry import analytics


@analytics.eventclass("codeowners.assignment")
class CodeownersAssignment(analytics.Event):
    organization_id: str
    project_id: str
    group_id: str
    updated_assignment: str


analytics.register(CodeownersAssignment)
