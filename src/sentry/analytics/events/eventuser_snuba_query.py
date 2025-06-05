from sentry import analytics


@analytics.eventclass("eventuser_snuba.query")
class EventUserSnubaQuery(analytics.Event):
    project_ids: list
    query: str
    query_try: int
    count_rows_returned: int
    count_rows_filtered: int
    query_time_ms: int


analytics.register(EventUserSnubaQuery)
