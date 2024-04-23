# Module to evaluate if other errors happened in the same trace.
#
# Refer to README in module for more details.
from sentry.api.endpoints.organization_events_trace import find_errors_for_trace_id
from sentry.api.utils import default_start_end_dates
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import bulk_snuba_queries


def trace_connected_analysis(group: Group) -> list[int]:
    event = group.get_recommended_event_for_environments()
    if not event or event.trace_id is None:
        return []

    start, end = default_start_end_dates()  # Today to 90 days back
    org_id = group.project.organization_id
    # XXX: Test without a list and validate the data type
    project_ids = list(Project.objects.filter(organization_id=org_id).values_list("id", flat=True))
    query = find_errors_for_trace_id(
        params={"start": start, "end": end, "organization_id": org_id, "project_id": project_ids},
        trace_id=event.trace_id,
        selected_columns=["issue.id"],
    )
    results = bulk_snuba_queries(
        [query.get_snql_query()], referrer=Referrer.API_ISSUES_RELATED_ISSUES.value
    )
    transformed_results = list(
        {
            datum["issue.id"]
            for datum in query.process_results(results[0])["data"]
            if datum["issue.id"] != group.id  # Exclude itself
        }
    )
    return transformed_results
