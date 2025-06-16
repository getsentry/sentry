from sentry import analytics


@analytics.eventclass("project.transferred")
class ProjectTransferredEvent(analytics.Event):
    old_organization_id: str
    new_organization_id: str
    project_id: str
    platform: str | None = None


analytics.register(ProjectTransferredEvent)
