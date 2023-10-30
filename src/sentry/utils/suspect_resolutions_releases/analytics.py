from sentry import analytics


class SuspectResolutionReleasesEvaluation(analytics.Event):
    type = "suspect_resolution_releases.evaluation"

    attributes = (
        analytics.Attribute("algo_version"),
        analytics.Attribute("current_release_id"),
        analytics.Attribute("issue_id"),
        analytics.Attribute("is_suspect_resolution"),
        analytics.Attribute("latest_release_id"),
    )


analytics.register(SuspectResolutionReleasesEvaluation)
