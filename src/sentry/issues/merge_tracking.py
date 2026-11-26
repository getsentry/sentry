import logging
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, TypedDict

from django.db import router, transaction
from django.db.models.functions import Now
from snuba_sdk import Column, Condition, Entity, Function, Limit, Op, Query, Request

from sentry import features
from sentry.constants import ALLOWED_FUTURE_DELTA
from sentry.issues.grouptype import GroupCategory
from sentry.issues.models.issuemergeoperation import (
    IssueMergeOperation,
    IssueUnmergeOperation,
    OperationStatus,
    OperationStep,
)
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.snuba.dataset import Dataset
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.referrer import Referrer
from sentry.utils.dates import outside_retention_with_modified_start
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


class OperationKwargs(TypedDict, total=False):
    operation_id: int


def operation_kwargs(operation_id: int | None) -> OperationKwargs:
    # Workers from the previous deploy only understand the original task payload.
    return {"operation_id": operation_id} if operation_id is not None else {}


def record_merge_request(
    project: Project,
    source_ids: list[int],
    destination_id: int,
    actor_id: int | None,
    *,
    service_account_id: int | None,
) -> int | None:
    if not features.has("organizations:issue-merge-operation-tracking", project.organization):
        return None

    hashes = GroupHash.objects.filter(project=project, group_id__in=source_ids)
    return IssueMergeOperation.objects.create(
        project=project,
        source_group_ids=source_ids,
        destination_group_id=destination_id,
        actor_id=actor_id,
        service_account_id=service_account_id,
        source_hashes_at_acceptance=list(hashes.values_list("hash", flat=True)),
    ).id


def record_unmerge_request(
    source: Group, hashes: Sequence[str], actor_id: int | None, *, service_account_id: int | None
) -> int | None:
    if source.issue_category != GroupCategory.ERROR or not features.has(
        "organizations:issue-merge-operation-tracking", source.project.organization
    ):
        return None

    return IssueUnmergeOperation.objects.create(
        project_id=source.project_id,
        source_group_id=source.id,
        group_hashes=list(hashes),
        actor_id=actor_id,
        service_account_id=service_account_id,
    ).id


def record_progress(
    model: type[IssueMergeOperation] | type[IssueUnmergeOperation],
    project_id: int,
    operation_id: int | None,
    *,
    status: OperationStatus = OperationStatus.RUNNING,
    **fields: Any,
) -> None:
    if operation_id is None:
        return
    try:
        # Isolate a failed tracking write even when the caller has an open transaction.
        with transaction.atomic(using=router.db_for_write(model)):
            model.objects.filter(
                id=operation_id,
                project_id=project_id,
                step=OperationStep.MOVE,
                status__in=(OperationStatus.QUEUED, OperationStatus.RUNNING),
            ).update(status=status, date_updated=Now(), **fields)
    except Exception:
        logger.exception(
            "issue_merge.tracking.update_failed",
            extra={"model": model.__name__, "project_id": project_id, "operation_id": operation_id},
        )


def record_end_send(
    model: type[IssueMergeOperation] | type[IssueUnmergeOperation],
    project_id: int,
    operation_id: int | None,
    cutoff: datetime | None,
) -> None:
    if cutoff is None:
        record_progress(model, project_id, operation_id, status=OperationStatus.NEEDS_ATTENTION)
    else:
        record_progress(
            model,
            project_id,
            operation_id,
            historical_cutoff=cutoff,
            step=OperationStep.WAIT_FOR_SNUBA,
        )


def record_merge_samples(
    project: Project, operation_id: int, eventstream_state: Mapping[str, Any]
) -> None:
    try:
        source_ids = eventstream_state["previous_group_ids"]
        now = datetime.now(UTC)
        _, start = outside_retention_with_modified_start(
            datetime(1970, 1, 1, tzinfo=UTC), now, project.organization
        )
        # Query the stored group IDs directly. Issue queries that expand redirects would
        # also include events already on the survivor.
        group = Column("group_id")
        request = Request(
            dataset=Dataset.Events.value,
            app_id="default",
            query=Query(
                match=Entity("events"),
                select=[
                    group,
                    Function("argMax", [Column("event_id"), Column("timestamp")], alias="sample"),
                ],
                where=[
                    Condition(Column("project_id"), Op.EQ, project.id),
                    Condition(group, Op.IN, source_ids),
                    Condition(Column("timestamp"), Op.GTE, start),
                    Condition(
                        Column("timestamp"),
                        Op.LT,
                        now + ALLOWED_FUTURE_DELTA + timedelta(seconds=1),
                    ),
                    Condition(Column("received"), Op.LTE, now),
                ],
                groupby=[group],
                limit=Limit(len(source_ids)),
            ),
            tenant_ids={"organization_id": project.organization_id},
        )
        rows = raw_snql_query(
            request,
            referrer=Referrer.ISSUES_MERGE_EVENT_SAMPLES,
            query_source=QuerySource.SENTRY_BACKEND,
        )["data"]
        samples = {str(row["group_id"]): row["sample"].replace("-", "") for row in rows}
        if len(samples) != len(source_ids):
            logger.warning(
                "merge.tracking.missing_samples",
                extra={
                    "project_id": project.id,
                    "operation_id": operation_id,
                    "missing_count": len(source_ids) - len(samples),
                },
            )
        record_progress(
            IssueMergeOperation, project.id, operation_id, sample_event_ids_by_source=samples
        )
    except Exception:
        logger.exception(
            "merge.tracking.sample_failed",
            extra={"project_id": project.id, "operation_id": operation_id},
        )
