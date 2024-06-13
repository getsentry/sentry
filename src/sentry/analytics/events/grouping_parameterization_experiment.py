from sentry import analytics


class GroupingParameterizationExperiment(analytics.Event):
    type = "grouping.experiments.parameterization"

    attributes = (
        analytics.Attribute("experiment_name"),
        analytics.Attribute("project_id"),
        analytics.Attribute("event_id"),
    )


analytics.register(GroupingParameterizationExperiment)
