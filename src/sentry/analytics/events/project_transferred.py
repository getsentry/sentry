from sentry import analytics


@analytics.eventclass("project.transferred")
class ProjectTransferredEvent(analytics.Event):
    old_organization_id: int
    new_organization_id: int
    project_id: int
    platform: str | None = None


analytics.register(ProjectTransferredEvent)
