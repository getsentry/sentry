from sentry import analytics


class SuspectResolutionEvaluation(analytics.Event):
    type = "suspect_resolution.evaluation"

    attributes = (
        analytics.Attribute("resolved_group_id"),
        analytics.Attribute("candidate_group_ids", type=list),
        analytics.Attribute("suspect_resolution_ids", type=list),
    )


analytics.register(SuspectResolutionEvaluation)
