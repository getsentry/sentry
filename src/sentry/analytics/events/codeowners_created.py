from sentry import analytics


@analytics.eventclass("codeowners.created")
class CodeownersCreated(analytics.Event):
    user_id: str | None = None
    organization_id: str
    project_id: str
    codeowners_id: str


analytics.register(CodeownersCreated)
