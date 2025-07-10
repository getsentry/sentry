from sentry import analytics


@analytics.eventclass("project.created")
class ProjectCreatedEvent(analytics.Event):
    user_id: str | None = None
    default_user_id: str
    organization_id: str
    origin: str | None = None
    project_id: str
    platform: str | None = None


analytics.register(ProjectCreatedEvent)
