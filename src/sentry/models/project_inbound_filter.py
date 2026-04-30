from __future__ import annotations

from hashlib import sha256
from typing import Any
from uuid import uuid4

from django.db import models
from django.db.models import CheckConstraint, Q, UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class ProjectInboundFilterType(models.TextChoices):
    IP_ADDRESS = "ip_address", "IP Address"
    RELEASE = "release", "Release"
    ERROR_MESSAGE = "error_message", "Error Message"
    LOG_MESSAGE = "log_message", "Log Message"
    TRACE_METRIC_NAME = "trace_metric_name", "Trace Metric Name"


def get_project_inbound_filter_value_hash(value: str) -> str:
    return sha256(value.encode()).hexdigest()


@cell_silo_model
class ProjectInboundFilter(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    rule_id = models.UUIDField(default=uuid4, unique=True, editable=False)
    user_identifier = models.CharField(max_length=200, null=True, blank=True)
    organization = FlexibleForeignKey("sentry.Organization")
    project = FlexibleForeignKey("sentry.Project")
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    updated_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    filter_type = models.CharField(max_length=32, choices=ProjectInboundFilterType.choices)
    value = models.TextField()
    value_hash = models.CharField(max_length=64)
    description = models.TextField(blank=True, default="")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectinboundfilter"
        constraints = [
            CheckConstraint(
                condition=Q(filter_type__in=ProjectInboundFilterType.values),
                name="sentry_pif_type_known",
            ),
            UniqueConstraint(
                fields=["project", "filter_type", "value_hash"],
                name="sentry_pif_proj_type_val_uniq",
            ),
            UniqueConstraint(
                fields=["project", "user_identifier"],
                condition=Q(user_identifier__isnull=False),
                name="sentry_pif_proj_userid_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "project", "filter_type", "id"],
                name="sentry_pif_org_proj_type_id",
            ),
            models.Index(
                fields=["project", "filter_type", "id"],
                name="sentry_pif_proj_type_id",
            ),
        ]

    __repr__ = sane_repr("organization_id", "project_id", "filter_type", "rule_id")

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.value_hash = get_project_inbound_filter_value_hash(self.value)
        super().save(*args, **kwargs)
