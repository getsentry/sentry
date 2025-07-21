from sentry import analytics


@analytics.eventclass("codeowners.created")
class CodeownersCreated(analytics.Event):
    user_id: str | None = None
    organization_id: str
    project_id: int
    codeowners_id: int


analytics.register(CodeownersCreated)
