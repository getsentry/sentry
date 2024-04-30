# Module to evaluate if other errors happened in the same trace.
#
# Refer to README in module for more details.
from sentry.api.utils import default_start_end_dates
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import bulk_snuba_queries


def trace_connected_analysis(group: Group) -> tuple[list[int], dict[str, str]]:
    """Determine if the group has a trace connected to it and return other issues that were part of it."""
    event = group.get_recommended_event_for_environments()
    if not event or event.trace_id is None:
        return [], {}

    org_id = group.project.organization_id
    # XXX: Test without a list and validate the data type
    project_ids = list(Project.objects.filter(organization_id=org_id).values_list("id", flat=True))
    start, end = default_start_end_dates()  # Today to 90 days back
    query = QueryBuilder(
        Dataset.Events,
        {"start": start, "end": end, "organization_id": org_id, "project_id": project_ids},
        query=f"trace:{event.trace_id}",
        selected_columns=["id", "issue.id"],
        # Don't add timestamp to this orderby as snuba will have to split the time range up and make multiple queries
        orderby=["id"],
        limit=100,
        config=QueryBuilderConfig(auto_fields=False),
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
    return transformed_results, {"event_id": event.event_id, "trace_id": event.trace_id}
