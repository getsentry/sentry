from sentry import analytics


@analytics.eventclass("codeowners.updated")
class CodeownersUpdated(analytics.Event):
    user_id: str | None = None
    organization_id: str
    project_id: str
    codeowners_id: str


analytics.register(CodeownersUpdated)
