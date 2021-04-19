from sentry import analytics


class CodeownersUpdated(analytics.Event):
    type = "codeowners.updated"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("codeowners_id"),
    )


analytics.register(CodeownersUpdated)
