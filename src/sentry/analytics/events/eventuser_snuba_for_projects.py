from sentry import analytics


class EventUserSnubaForProjects(analytics.Event):
    type = "eventuser_snuba.for_projects"

    attributes = (
        analytics.Attribute("project_ids", type=list),
        analytics.Attribute("total_tries", type=int),
        analytics.Attribute("total_rows_returned", required=True, type=int),
        analytics.Attribute("total_time_ms", type=int),
    )


analytics.register(EventUserSnubaForProjects)
