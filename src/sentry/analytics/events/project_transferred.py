from sentry import analytics


class ProjectTransferredEvent(analytics.Event):
    type = "project.transferred"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("new_organization_id"),
    )


analytics.register(ProjectTransferredEvent)
