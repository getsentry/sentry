from sentry import analytics


@analytics.eventclass("eventuser_snuba.for_projects")
class EventUserSnubaForProjects(analytics.Event):
    project_ids: list
    total_tries: int
    total_rows_returned: int
    total_time_ms: int


analytics.register(EventUserSnubaForProjects)
