from sentry import analytics


class SuspectResolutionEvaluation(analytics.Event):
    type = "suspect_resolution.ids"

    attributes = (
        analytics.Attribute("resolved_group_id"),
        analytics.Attribute("suspect_resolution_id"),
    )


class CandidateGroupEvaluation(analytics.Event):
    type = "candidate_group.ids"

    attributes = (
        analytics.Attribute("resolved_group_id"),
        analytics.Attribute("candidate_group_id"),
    )


analytics.register(SuspectResolutionEvaluation)
analytics.register(CandidateGroupEvaluation)
