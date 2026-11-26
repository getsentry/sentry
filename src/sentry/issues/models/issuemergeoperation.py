from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import timedelta
from typing import Any, NamedTuple, Self
from uuid import UUID, uuid4

from django.contrib.postgres.fields import ArrayField
from django.db import models, router, transaction
from django.db.models import Q
from django.db.models.functions import Now

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, FlexibleForeignKey, cell_silo_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class OperationStatus(models.TextChoices):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETE = "complete"
    NEEDS_ATTENTION = "needs_attention"


class OperationStep(models.TextChoices):
    MOVE = "move"
    WAIT_FOR_SNUBA = "wait_for_snuba"


UNFINISHED_STATUSES = (
    OperationStatus.QUEUED,
    OperationStatus.RUNNING,
    OperationStatus.NEEDS_ATTENTION,
)


class StaleOperationBatch(Exception):
    """Another worker owns the operation or the batch has already been applied."""


class BaseIssueOperation(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    actor_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    service_account_id = HybridCloudForeignKey(
        "service_accounts.ServiceAccount", null=True, on_delete="SET_NULL"
    )
    status = models.CharField(
        max_length=32, choices=OperationStatus, default=OperationStatus.QUEUED
    )
    step = models.CharField(max_length=32, choices=OperationStep, default=OperationStep.MOVE)
    worker_token = models.UUIDField(null=True)
    lease_expires_at = models.DateTimeField(null=True, db_index=True)
    retries_without_progress = models.PositiveIntegerField(default=0)
    historical_cutoff = models.DateTimeField(null=True)
    batch_cursor = models.JSONField(default=dict)

    class Meta:
        abstract = True
        constraints = [
            models.CheckConstraint(
                condition=Q(actor_id__isnull=True) | Q(service_account_id__isnull=True),
                name="%(class)s_one_actor",
            ),
        ]

    def claim(self, *, lease_duration: timedelta) -> UUID | None:
        """Claim a queued move or replace an expired worker. Only one claimant wins."""
        token = uuid4()
        claimed = (
            type(self)
            .objects.filter(
                Q(status=OperationStatus.QUEUED)
                | Q(status=OperationStatus.RUNNING, lease_expires_at__lte=Now()),
                id=self.id,
                step=OperationStep.MOVE,
            )
            .update(
                worker_token=token,
                status=OperationStatus.RUNNING,
                lease_expires_at=Now() + lease_duration,
                date_updated=Now(),
            )
        )
        return token if claimed else None

    @contextmanager
    def apply_batch(
        self,
        *,
        worker_token: UUID,
        expected_cursor: dict[str, Any],
        next_cursor: dict[str, Any],
        lease_duration: timedelta,
    ) -> Iterator[Self]:
        """Commit the caller's local writes and the cursor in the same transaction."""
        if expected_cursor == next_cursor:
            raise ValueError("A batch must advance the cursor")
        cls = type(self)
        with transaction.atomic(using=router.db_for_write(cls)):
            operation = cls.objects.select_for_update().get_or_none(
                id=self.id,
                status=OperationStatus.RUNNING,
                step=OperationStep.MOVE,
                worker_token=worker_token,
                lease_expires_at__gt=Now(),
                batch_cursor=expected_cursor,
            )
            if operation is None:
                raise StaleOperationBatch(self.id)
            yield operation
            cls.objects.filter(pk=operation.pk).update(
                batch_cursor=next_cursor,
                lease_expires_at=Now() + lease_duration,
                retries_without_progress=0,
                date_updated=Now(),
            )


@cell_silo_model
class IssueMergeOperation(BaseIssueOperation):
    # Source issues are deleted by a successful merge. Keep their original IDs.
    source_group_ids = ArrayField(BoundedBigIntegerField())
    destination_group_id = BoundedBigIntegerField()
    # A snapshot for the Merged Issues view. The merge itself moves by source issue ID.
    source_hashes_at_acceptance = ArrayField(models.CharField(max_length=32), default=list)
    sample_event_ids_by_source = models.JSONField(default=dict)

    class Meta(BaseIssueOperation.Meta):
        app_label = "sentry"
        db_table = "sentry_issuemergeoperation"


@cell_silo_model
class IssueUnmergeOperation(BaseIssueOperation):
    source_group_id = BoundedBigIntegerField()
    # GroupHash.hash values selected in a single unmerge request.
    group_hashes = ArrayField(models.CharField(max_length=32))
    destination_group_id = BoundedBigIntegerField(null=True)

    class Meta(BaseIssueOperation.Meta):
        app_label = "sentry"
        db_table = "sentry_issueunmergeoperation"


class UnfinishedIssueOperations(NamedTuple):
    merges: list[IssueMergeOperation]
    unmerges: list[IssueUnmergeOperation]


def unfinished_operations_for_group(*, project_id: int, group_id: int) -> UnfinishedIssueOperations:
    merges = IssueMergeOperation.objects.filter(
        Q(source_group_ids__contains=[group_id]) | Q(destination_group_id=group_id),
        project_id=project_id,
        status__in=UNFINISHED_STATUSES,
    )
    unmerges = IssueUnmergeOperation.objects.filter(
        Q(source_group_id=group_id) | Q(destination_group_id=group_id),
        project_id=project_id,
        status__in=UNFINISHED_STATUSES,
    )
    return UnfinishedIssueOperations(merges=list(merges), unmerges=list(unmerges))
