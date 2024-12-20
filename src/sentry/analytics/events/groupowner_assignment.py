from sentry import analytics


class GroupOwnerAssignment(analytics.Event):
    type = "groupowner.assignment"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("new_assignment", type=bool),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("group_owner_type"),
        analytics.Attribute("method", required=False),
    )


analytics.register(GroupOwnerAssignment)
