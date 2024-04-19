# Module to evaluate if other errors happened in the same trace.
#
# Refer to README in module for more details.
from sentry.api.endpoints.organization_events_trace import find_errors_for_trace_id
from sentry.models.group import Group
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import bulk_snql_query


def trace_connected_analysis(group: Group) -> list[int]:
    event = group.get_recommended_event_for_environments()
    if not event or event.trace_id is None:
        return []
    # project.id is an integer representing the project an issue belongs to
    # issue is the short slug represenging an issue
    # title is the title of the issue
    columns = ["project.id", "issue", "title"]
    query = find_errors_for_trace_id(params={}, trace_id=event.trace_id, selected_columns=columns)
    results = bulk_snql_query(
        [query.get_snql_query()],
        referrer=Referrer.API_ISSUES_RELATED_ISSUES.value,
    )
    transformed_results = [
        query.process_results(result)["data"] for result, query in zip(results, [query])
    ]
    return transformed_results  # type: ignore[return-value]
