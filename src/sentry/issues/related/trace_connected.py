# Module to evaluate if other errors happened in the same trace.
#
# Refer to README in module for more details.
from sentry.api.endpoints.organization_events_trace import find_errors_for_trace_id
from sentry.api.utils import default_start_end_dates
from sentry.models.group import Group
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import bulk_snuba_queries


def trace_connected_analysis(group: Group) -> list[int]:
    event = group.get_recommended_event_for_environments()
    if not event or event.trace_id is None:
        return []

    start, end = default_start_end_dates()  # Today to 90 days back
    query = find_errors_for_trace_id(
        params={
            "start": start,
            "end": end,
            "organization_id": group.project.organization_id,
        },
        trace_id=event.trace_id,
        selected_columns=["id", "project.id", "issue", "title"],
    )
    results = bulk_snuba_queries(
        [query.get_snql_query()], referrer=Referrer.API_ISSUES_RELATED_ISSUES.value
    )
    transformed_results = [
        query.process_results(result)["data"] for result, query in zip(results, [query])
    ]
    return transformed_results  # type: ignore[return-value]
