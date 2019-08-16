from __future__ import absolute_import

from sentry import analytics


class RepoLinkedEvent(analytics.Event):
    type = "repo.linked"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("repository_id"),
        analytics.Attribute("provider"),
    )


analytics.register(RepoLinkedEvent)
