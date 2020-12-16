from __future__ import absolute_import, print_function

from sentry import analytics


class ReleaseSetCommitsEvent(analytics.Event):
    type = "release.set_commits"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_ids"),
        analytics.Attribute("user_agent", required=False),
    )


analytics.register(ReleaseSetCommitsEvent)
