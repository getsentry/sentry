from sentry import analytics


class ProjectTransferredEvent(analytics.Event):
    type = "project.transferred"

    attributes = (
        analytics.Attribute("old_organization_id"),
        analytics.Attribute("new_organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("platform", required=False),
    )


analytics.register(ProjectTransferredEvent)
