from sentry import analytics


@analytics.eventclass("grouping.experiments.parameterization")
class GroupingParameterizationExperiment(analytics.Event):
    experiment_name: str
    project_id: str
    event_id: str


analytics.register(GroupingParameterizationExperiment)
