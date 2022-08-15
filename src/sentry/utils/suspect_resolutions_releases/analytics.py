from sentry import analytics


class SuspectResolutionReleasesEvaluation(analytics.Event):
    type = "suspect_resolution_releases.evaluation"

    attributes = (
        analytics.Attribute("algo_version"),
        analytics.Attribute("release_id"),
        analytics.Attribute("issue_id"),
        analytics.Attribute("project_id"),
    )


analytics.register(SuspectResolutionReleasesEvaluation)
