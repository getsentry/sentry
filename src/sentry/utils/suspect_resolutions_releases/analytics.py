from sentry import analytics


class SuspectResolutionReleasesEvaluation(analytics.Event):
    type = "suspect_resolution_releases.evaluation"

    attributes = (
        analytics.Attribute("algo_version"),
        analytics.Attribute("latest_release_id"),
        analytics.Attribute("current_release_id"),
        analytics.Attribute("issue_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("is_suspect_resolution"),
    )


analytics.register(SuspectResolutionReleasesEvaluation)
