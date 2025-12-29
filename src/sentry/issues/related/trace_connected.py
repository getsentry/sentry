# Module to evaluate if other errors happened in the same trace.
#
# Refer to README in module for more details.
import logging

from sentry.api.utils import default_start_end_dates
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.services import eventstore
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.snuba.dataset import Dataset
from sentry.snuba.occurrences_rpc import Occurrences
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import bulk_snuba_queries

logger = logging.getLogger(__name__)


# If we drop trace connected issues from similar issues we can stop using the group
def trace_connected_analysis(
    group: Group, event_id: str | None = None, project_id: int | None = None
) -> tuple[list[int], dict[str, str]]:
    """Determine if the group has a trace connected to it and return other issues that were part of it."""
    issues: list[int] = []
    meta: dict[str, str] = {}
    if event_id:
        # If we are passing an specific event_id, we need to get the project_id
        assert project_id is not None
        event = eventstore.backend.get_event_by_id(project_id, event_id, group_id=group.id)
        # If we are requesting an specific event, we want to be notified with an error
        assert event is not None
        # This ensures that the event is actually part of the group and we are notified
        assert event.group is not None
        assert event.group.id == group.id
    else:
        # If we drop trace connected issues from similar issues we can remove this
        event = group.get_recommended_event_for_environments()

    if event:
        issues, meta = trace_connected_issues(event)
    else:
        meta["error"] = "No event found for group."

    return issues, meta


def _trace_connected_issues_snuba(
    trace_id: str,
    org_id: int,
    project_ids: list[int],
    exclude_group_id: int,
) -> list[int]:
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
    transformed_results = list(
        {
            datum["issue.id"]
            for datum in query.process_results(results[0])["data"]
            if datum["issue.id"] != exclude_group_id  # Exclude itself
        }
    )
    return transformed_results


def _trace_connected_issues_eap(
    trace_id: str,
    organization: Organization,
    projects: list[Project],
    exclude_group_id: int,
) -> list[int]:
    """EAP implementation of trace_connected_issues."""
    start, end = default_start_end_dates()  # Today to 90 days back
    snuba_params = SnubaParams(
        start=start,
        end=end,
        organization=organization,
        projects=projects,
        environments=[],
    )

    try:
        result = Occurrences.run_table_query(
            params=snuba_params,
            query_string=f"trace:{trace_id}",
            selected_columns=["group_id", "count()"],
            orderby=None,
            offset=0,
            limit=100,
            referrer=Referrer.API_ISSUES_RELATED_ISSUES.value,
            config=SearchResolverConfig(),
        )
        return list(
            {
                int(row.get("group_id"))
                for row in result["data"]
                if row.get("group_id") and int(row.get("group_id")) != exclude_group_id
            }
        )
    except Exception:
        logger.exception(
            "Fetching trace connected issues from EAP failed",
            extra={
                "trace_id": trace_id,
                "organization_id": organization.id,
                "exclude_group_id": exclude_group_id,
            },
        )
        return []


def trace_connected_issues(event: Event | GroupEvent) -> tuple[list[int], dict[str, str]]:
    meta = {"event_id": event.event_id}
    if event.trace_id:
        meta["trace_id"] = event.trace_id
    else:
        meta["error"] = "No trace_id found in event."
        return [], meta

    assert event.group is not None
    group = event.group
    org_id = group.project.organization_id
    organization = Organization.objects.get(id=org_id)
    projects = list(Project.objects.filter(organization_id=org_id))
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
            snuba_results, eap_results, "issues.related.trace_connected_issues"
        )

    return issues, meta
