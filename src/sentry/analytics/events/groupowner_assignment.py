from sentry import analytics


@analytics.eventclass("groupowner.assignment")
class GroupOwnerAssignment(analytics.Event):
    organization_id: str
    project_id: str
    group_id: str
    new_assignment: bool
    user_id: str | None = None
    group_owner_type: str
    method: str | None = None


analytics.register(GroupOwnerAssignment)
