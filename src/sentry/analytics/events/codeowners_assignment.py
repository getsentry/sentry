from typing import int
from sentry import analytics


@analytics.eventclass("codeowners.assignment")
class CodeOwnersAssignment(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    updated_assignment: bool


analytics.register(CodeOwnersAssignment)
