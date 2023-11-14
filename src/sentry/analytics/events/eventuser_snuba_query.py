from sentry import analytics


class EventUserSnubaQuery(analytics.Event):
    type = "eventuser_snuba.query"

    attributes = (
        analytics.Attribute("project_ids", type=list),
        analytics.Attribute("query"),
        analytics.Attribute("count_rows_returned", required=True, type=int),
        analytics.Attribute("count_rows_filtered", required=True, type=int),
    )


analytics.register(EventUserSnubaQuery)
