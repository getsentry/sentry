from __future__ import absolute_import, print_function

from sentry import analytics


class ReleaseSetCommitsLocalEvent(analytics.Event):
    type = "release.set_commits_local"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_ids"),
        analytics.Attribute("user_agent", required=False),
    )


analytics.register(ReleaseSetCommitsLocalEvent)
