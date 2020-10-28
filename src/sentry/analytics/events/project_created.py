from __future__ import absolute_import

from sentry import analytics


class ProjectCreatedEvent(analytics.Event):
    type = "project.created"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("platform", required=False),
    )


analytics.register(ProjectCreatedEvent)
