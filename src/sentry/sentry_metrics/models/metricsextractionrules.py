from __future__ import annotations

import logging

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import ArrayField, FlexibleForeignKey, Model, region_silo_model
from sentry.db.models.fields import uuid
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.sentry_metrics.extraction_rules import MetricsExtractionRule

logger = logging.getLogger(__name__)


@region_silo_model
class SpanAttributeExtractionRuleCondition(Model):
    __relocation_scope__ = RelocationScope.Organization

    date_modified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)
    created_by_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    project = FlexibleForeignKey("sentry.Project")

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    value = models.CharField(max_length=1000, null=True, blank=True)
    config = FlexibleForeignKey(
        "sentry.SpanAttributeExtractionRuleConfig", related_name="conditions"
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_spanattributeextractionrulecondition"

    def generate_mris(self):
        mris = []
        metric_types = MetricsExtractionRule.infer_types(self.config.aggregates)
        for metric_type in metric_types:
            mris.append(f"{metric_type}:custom/internal_{self.id}@{self.config.unit}")
        return mris


@region_silo_model
class SpanAttributeExtractionRuleConfig(Model):
    __relocation_scope__ = RelocationScope.Organization

    date_modified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)
    created_by_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)

    span_attribute = models.CharField(max_length=1000)
    unit = models.CharField(max_length=100, default="none")
    tags = ArrayField(of=models.CharField(max_length=1000))
    aggregates = ArrayField(of=models.CharField(max_length=50))

    class Meta:
        unique_together = ("project", "span_attribute")
        app_label = "sentry"
        db_table = "sentry_spanattributeextractionruleconfig"
