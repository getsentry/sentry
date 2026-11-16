# Module to evaluate if other errors happened in the same trace.
from sentry.api.utils import default_start_end_dates
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.occurrences.common_queries import get_group_ids_for_trace_id
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.snuba.dataset import Dataset
from sentry.snuba.occurrences_rpc import OccurrenceCategory
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import bulk_snuba_queries


def _trace_connected_issues_snuba(
    trace_id: str,
    org_id: int,
    project_ids: list[int],
    exclude_group_id: int,
) -> set[int]:
    """Snuba implementation of trace_connected_issues."""
    start, end = default_start_end_dates()  # Today to 90 days back
    query = DiscoverQueryBuilder(
        Dataset.Events,
        {"start": start, "end": end, "organization_id": org_id, "project_id": project_ids},
        query=f"trace:{trace_id}",
        selected_columns=["id", "issue.id"],
        # Don't add timestamp to this orderby as snuba will have to split the time range up and make multiple queries
        orderby=["id"],
        limit=100,
        config=QueryBuilderConfig(auto_fields=False),
    )
    results = bulk_snuba_queries(
        [query.get_snql_query()], referrer=Referrer.API_ISSUES_RELATED_ISSUES.value
    )
    return {
        datum["issue.id"]
        for datum in query.process_results(results[0])["data"]
        if datum["issue.id"] != exclude_group_id  # Exclude itself
    }


def _trace_connected_issues_eap(
    trace_id: str,
    organization: Organization,
    projects: list[Project],
    exclude_group_id: int,
) -> set[int]:
    """EAP implementation of trace_connected_issues."""
    start, end = default_start_end_dates()  # Today to 90 days back
    snuba_params = SnubaParams(
        start=start,
        end=end,
        organization=organization,
        projects=projects,
        environments=[],
    )

    group_ids = get_group_ids_for_trace_id(
        snuba_params=snuba_params,
        trace_id=trace_id,
        referrer=Referrer.API_ISSUES_RELATED_ISSUES.value,
        occurrence_category=OccurrenceCategory.ERROR,
        limit=100,
    )
    group_ids.discard(exclude_group_id)
    return group_ids


def trace_connected_issues(
    event: Event | GroupEvent, projects: list[Project]
) -> tuple[list[int], dict[str, str]]:
    meta = {"event_id": event.event_id}
    if event.trace_id:
        meta["trace_id"] = event.trace_id
    else:
        meta["error"] = "No trace_id found in event."
        return [], meta

    assert event.group is not None
    group = event.group
    organization = group.project.organization
    org_id = organization.id
    project_ids = [p.id for p in projects]

    snuba_results = _trace_connected_issues_snuba(
        trace_id=event.trace_id,
        org_id=org_id,
        project_ids=project_ids,
        exclude_group_id=group.id,
    )
    issues = snuba_results

    if EAPOccurrencesComparator.should_check_experiment("issues.related.trace_connected_issues"):
        eap_results = _trace_connected_issues_eap(
            trace_id=event.trace_id,
            organization=organization,
            projects=projects,
            exclude_group_id=group.id,
        )
        issues = EAPOccurrencesComparator.check_and_choose(
            snuba_results,
            eap_results,
            "issues.related.trace_connected_issues",
            is_experimental_data_nullish=len(eap_results) == 0,
            reasonable_match_comparator=lambda snuba, eap: eap.issubset(snuba),
            debug_context={
                "trace_id": event.trace_id,
                "organization_id": org_id,
                "project_ids": project_ids,
                "exclude_group_id": group.id,
            },
        )

    return list(issues), meta
