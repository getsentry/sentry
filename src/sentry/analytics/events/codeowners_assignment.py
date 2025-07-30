from sentry import analytics


class CodeOwnersAssignment(analytics.Event):
    type = "codeowners.assignment"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("updated_assignment"),
    )


analytics.register(CodeOwnersAssignment)
