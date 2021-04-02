from sentry import analytics


class CodeownersCreated(analytics.Event):
    type = "codeowners.created"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("codeowners_id"),
    )


analytics.register(CodeownersCreated)
