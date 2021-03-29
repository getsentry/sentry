from sentry import analytics


class CodeownersAssignment(analytics.Event):
    type = "codeowners.assignment"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_ids"),
        analytics.Attribute("group_id"),
    )


analytics.register(CodeownersAssignment)
