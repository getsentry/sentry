from sentry import analytics


class SuspectResolutionEvaluation(analytics.Event):
    type = "suspect_resolution.evaluation"

    attributes = (
        analytics.Attribute("resolved_group_id"),
        analytics.Attribute("candidate_group_id"),
        analytics.Attribute("resolved_group_resolution_type"),
        analytics.Attribute("pearson_r_coefficient"),
        analytics.Attribute("pearson_r_start_time"),
        analytics.Attribute("pearson_r_end_time"),
        analytics.Attribute("pearson_r_resolution_time"),
        analytics.Attribute("is_commit_correlated"),
    )


analytics.register(SuspectResolutionEvaluation)
