from datetime import UTC, datetime

from django.db.models.functions import Now
from snuba_sdk import Column, Condition, Entity, Flags, Limit, Op, Query, Request

from sentry.issues.merge_tracking import retained_event_conditions
from sentry.issues.models.issuemergeoperation import (
    IssueMergeOperation,
    IssueUnmergeOperation,
    OperationStatus,
    OperationStep,
)
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.snuba.dataset import Dataset
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


def complete_if_events_moved(operation: IssueMergeOperation | IssueUnmergeOperation) -> bool:
    """Return True only when this check marks a waiting operation complete.

    Query errors propagate so the caller can distinguish a failed check from a
    move still in progress. Either leaves the operation available for another poll.
    """
    if (
        operation.status != OperationStatus.RUNNING
        or operation.step != OperationStep.WAIT_FOR_SNUBA
        or operation.historical_cutoff is None
    ):
        return False

    if isinstance(operation, IssueMergeOperation):
        moved = _merge_samples_on_destination(operation)
    else:
        moved = _unmerge_is_visible(operation, operation.historical_cutoff)

    if not moved:
        return False
    updated = (
        type(operation)
        .objects.filter(
            project_id=operation.project_id,
            id=operation.id,
            status=OperationStatus.RUNNING,
            step=OperationStep.WAIT_FOR_SNUBA,
        )
        .update(status=OperationStatus.COMPLETE, date_updated=Now())
    )
    return updated == 1


def _merge_samples_on_destination(operation: IssueMergeOperation) -> bool:
    samples = operation.sample_event_ids_by_source
    sources = {str(source) for source in operation.source_group_ids}
    expected = set(samples.values())
    if not sources or samples.keys() != sources or len(expected) != len(sources):
        return False

    found = _matching_event_ids(
        operation.project,
        operation.destination_group_id,
        [Condition(Column("event_id"), Op.IN, sorted(expected))],
        limit=len(expected),
        distinct=True,
        referrer=Referrer.ISSUES_MERGE_COMPLETION,
    )
    return found == expected


def _unmerge_is_visible(operation: IssueUnmergeOperation, cutoff: datetime) -> bool:
    hashes = set(operation.group_hashes)
    if not hashes or operation.destination_group_id is None:
        return False
    owned_count = GroupHash.objects.filter(
        project_id=operation.project_id, group_id=operation.destination_group_id, hash__in=hashes
    ).count()
    if owned_count != len(hashes):
        return False

    remaining = _matching_event_ids(
        operation.project,
        operation.source_group_id,
        [
            Condition(Column("primary_hash"), Op.IN, sorted(hashes)),
            Condition(Column("received"), Op.LTE, cutoff),
        ],
        limit=1,
        referrer=Referrer.ISSUES_UNMERGE_COMPLETION,
    )
    return not remaining


def _matching_event_ids(
    project: Project,
    group_id: int,
    conditions: list[Condition],
    *,
    limit: int,
    referrer: Referrer,
    distinct: bool = False,
) -> set[str]:
    event_id = Column("event_id")
    request = Request(
        dataset=Dataset.Events.value,
        app_id="default",
        query=Query(
            match=Entity("events"),
            select=[event_id],
            where=[
                *retained_event_conditions(project, datetime.now(UTC)),
                Condition(Column("group_id"), Op.EQ, group_id),
                *conditions,
            ],
            groupby=[event_id] if distinct else None,
            limit=Limit(limit),
        ),
        flags=Flags(consistent=True),
        tenant_ids={"organization_id": project.organization_id},
    )
    rows = raw_snql_query(request, referrer=referrer, query_source=QuerySource.SENTRY_BACKEND)[
        "data"
    ]
    return {row["event_id"].replace("-", "") for row in rows}
