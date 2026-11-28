from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model
from sentry.db.models.base import DefaultFieldsModel


@cell_silo_model
class WorkflowRun(DefaultFieldsModel):
    """The worker's durable checkpoint and the immutable definition accepted for this run."""

    __relocation_scope__ = RelocationScope.Excluded
    uuid = models.UUIDField(unique=True)
    organization = FlexibleForeignKey("sentry.Organization")
    user_id = models.BigIntegerField()
    request_id = models.UUIDField()
    version = models.PositiveBigIntegerField(default=1)
    definition = models.JSONField()
    checkpoint = models.JSONField()

    class Meta:
        app_label = "investigations"
        indexes = [models.Index(fields=("date_added", "id"), name="inv_workflow_retention")]
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "request_id"), name="inv_workflow_request"
            )
        ]


@cell_silo_model
class WorkflowNodeRun(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded
    uuid = models.UUIDField(unique=True)
    run = FlexibleForeignKey(WorkflowRun, related_name="nodes")
    checkpoint = models.JSONField()
    activity = models.JSONField(default=dict)
    next_check_at = models.DateTimeField(null=True, db_index=True)

    class Meta:
        app_label = "investigations"
