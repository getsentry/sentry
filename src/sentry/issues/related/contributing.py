"""
Finds the error issues behind a metric issue.

It runs the search behind the Contributing Issues section of a metric issue's sidebar
(metricDetectorTriggeredSection.tsx): the detector's query as an issue search, in the metric
issue's project, over the time the metric issue was open.
"""

from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone

from sentry import search
from sentry.api.event_search import SearchFilter
from sentry.api.helpers.group_index.index import parse_and_convert_issue_search_query
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.incidents.grouptype import MetricIssue
from sentry.issues.related.types import (
    ContributingMeta,
    RelatedIssueRelation,
    RelatedIssuesContext,
    RelationType,
    RelationTypeResult,
    RelationTypeStatus,
)
from sentry.models.environment import Environment
from sentry.models.groupopenperiod import GroupOpenPeriod, get_latest_open_period
from sentry.services.eventstore.models import GroupEvent
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.safe import get_path
from sentry.utils.snuba import SnubaError

# What this type finds, for the API docs
CONTRIBUTING_DESCRIPTION = (
    "For a metric issue on errors or releases: the error issues in the same project that match "
    "the detector's query while the metric issue was open, most events first."
)
NOT_A_METRIC_ISSUE_DETAIL = "Only metric issues have contributing issues."
NO_DETECTOR_QUERY_DETAIL = "This metric issue's event doesn't record its detector's query."
UNSUPPORTED_DATASET_DETAIL = "Only detectors on errors or releases have contributing issues."
NO_OPEN_PERIOD_DETAIL = "This metric issue has no open period."
UNSUPPORTED_QUERY_DETAIL = (
    "Issue search can't run this detector's query, for example because it uses AND or OR."
)
ISSUE_SEARCH_UNAVAILABLE_DETAIL = "Issue search is temporarily unavailable. Try again later."

# The sidebar shows contributing issues for these datasets only (getDetectorDataset.tsx)
ERRORS_DATASETS = {Dataset.Events.value, Dataset.IssuePlatform.value}
RELEASES_DATASETS = {Dataset.Metrics.value, Dataset.Sessions.value}
DEFAULT_ERROR_EVENT_TYPES = {"error", "default"}


def contributing_issues(ctx: RelatedIssuesContext) -> RelationTypeResult:
    """Error issues matching the detector's query while the metric issue was open, most events first."""
    group, event = ctx.group, ctx.event
    if group.type != MetricIssue.type_id:
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NOT_A_METRIC_ISSUE_DETAIL)
    snuba_query = _detector_query(event)
    if snuba_query is None:
        return _result(
            RelationTypeStatus.NOT_APPLICABLE, detail=NO_DETECTOR_QUERY_DETAIL, event=event
        )
    if snuba_query["dataset"] not in ERRORS_DATASETS | RELEASES_DATASETS:
        return _result(
            RelationTypeStatus.NOT_APPLICABLE, detail=UNSUPPORTED_DATASET_DETAIL, event=event
        )
    open_period = get_latest_open_period(group)
    if open_period is None:
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NO_OPEN_PERIOD_DETAIL, event=event)

    start, end = _search_range(open_period, snuba_query["time_window"])
    try:
        group_ids = _search_issues(ctx, snuba_query, start, end)
    except ValidationError:
        return _result(
            RelationTypeStatus.NOT_APPLICABLE, detail=UNSUPPORTED_QUERY_DETAIL, event=event
        )
    except SnubaError:
        return _result(
            RelationTypeStatus.UNAVAILABLE,
            detail=ISSUE_SEARCH_UNAVAILABLE_DETAIL,
            event=event,
            start=start,
            end=end,
        )
    return _result(
        RelationTypeStatus.OK,
        event=event,
        start=start,
        end=end,
        relations={group_id: {"type": RelationType.CONTRIBUTING} for group_id in group_ids},
    )


def _detector_query(event: GroupEvent | None) -> Mapping[str, Any] | None:
    """
    The detector's query from when it fired, saved in the event's evidence data.
    """
    if event is None or event.occurrence is None:
        return None
    return get_path(event.occurrence.evidence_data, "data_sources", 0, "query_obj", "snuba_query")


def _search_range(
    open_period: GroupOpenPeriod, time_window: int
) -> tuple[datetime, datetime | None]:
    # Add 1 minute for processing delay
    start = open_period.date_started - timedelta(seconds=time_window, minutes=1)
    return start.replace(second=0, microsecond=0), open_period.date_ended


def _search_issues(
    ctx: RelatedIssuesContext, snuba_query: Mapping[str, Any], start: datetime, end: datetime | None
) -> list[int]:
    """
    IDs of the issues in the metric issue's project that match the detector's query between
    `start` and `end` (or now), most events first.
    """
    project = ctx.group.project
    environments = None
    if snuba_query["environment"]:
        try:
            environments = [
                Environment.get_for_organization_id(
                    project.organization_id, snuba_query["environment"]
                )
            ]
        except Environment.DoesNotExist:
            return []
    search_filters = parse_and_convert_issue_search_query(
        _issue_search_query(snuba_query), project.organization, [project], environments, ctx.user
    )
    issues = search.backend.query(
        projects=[project],
        environments=environments,
        search_filters=[f for f in search_filters if isinstance(f, SearchFilter)],
        date_from=start,
        date_to=end or timezone.now(),
        sort_by="freq",
        limit=ctx.limit,
        actor=ctx.user,
        referrer=Referrer.API_ISSUES_RELATED_ISSUES.value,
    )
    return [issue.id for issue in issues]


def _issue_search_query(snuba_query: Mapping[str, Any]) -> str:
    """
    The issue search for the detector's query, built as the sidebar builds it
    (DetectorErrorsConfig.toSnubaQueryString). An errors detector that counts other than the
    default event types adds an event.type filter.
    """
    event_types = snuba_query["event_types"]
    event_type_filter = ""
    if (
        snuba_query["dataset"] in ERRORS_DATASETS
        and event_types
        and set(event_types) != DEFAULT_ERROR_EVENT_TYPES
    ):
        event_type_filter = (
            f"event.type:{event_types[0]}"
            if len(event_types) == 1
            else f"event.type:[{', '.join(event_types)}]"
        )
    parts = ("issue.type:error", event_type_filter, snuba_query["query"])
    return " ".join(part for part in parts if part)


def _result(
    status: RelationTypeStatus,
    *,
    detail: str | None = None,
    event: GroupEvent | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    relations: dict[int, RelatedIssueRelation] | None = None,
) -> RelationTypeResult:
    meta: ContributingMeta = {"type": RelationType.CONTRIBUTING, "status": status}
    if detail is not None:
        meta["detail"] = detail
    if event is not None:
        meta["eventId"] = event.event_id
    if start is not None:
        meta["start"] = start.isoformat()
    if end is not None:
        meta["end"] = end.isoformat()
    return RelationTypeResult(meta, relations or {})
