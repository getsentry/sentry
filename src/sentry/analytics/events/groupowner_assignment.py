from typing import int
from sentry import analytics


@analytics.eventclass("groupowner.assignment")
class GroupOwnerAssignment(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    new_assignment: bool
    user_id: int | None = None
    group_owner_type: int
    method: str | None = None


analytics.register(GroupOwnerAssignment)
