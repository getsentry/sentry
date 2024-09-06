from __future__ import annotations

from typing import Any

from django.db import models
from django.db.models import CASCADE

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    ArrayField,
    DefaultFieldsModelExisting,
    FlexibleForeignKey,
    region_silo_model,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.project import Project
from sentry.sentry_metrics.configuration import HARD_CODED_UNITS


@region_silo_model
class SpanAttributeExtractionRuleCondition(DefaultFieldsModelExisting):
    __relocation_scope__ = RelocationScope.Organization

    created_by_id = HybridCloudForeignKey("sentry.User", on_delete="SET_NULL", null=True)

    value = models.CharField(max_length=1000, null=True, blank=True)
    config = FlexibleForeignKey(
        "sentry.SpanAttributeExtractionRuleConfig",
        related_name="conditions",
        on_delete=CASCADE,
        db_constraint=False,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_spanattributeextractionrulecondition"
        # The length of the entries in the auth_permission table were too long with the auto-generated verbose name,
        # therefore we override it with a shorter string despite being less legible.
        verbose_name = "SpanAttrCond"


@region_silo_model
class SpanAttributeExtractionRuleConfig(DefaultFieldsModelExisting):
    __relocation_scope__ = RelocationScope.Organization

    created_by_id = HybridCloudForeignKey("sentry.User", on_delete="SET_NULL", null=True)
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)

    span_attribute = models.CharField(max_length=1000)
    unit = models.CharField(max_length=100, default="none")
    tags = ArrayField(of=models.CharField(max_length=1000))
    aggregates = ArrayField(of=models.CharField(max_length=50))

    class Meta:
        unique_together = ("project", "span_attribute")
        app_label = "sentry"
        db_table = "sentry_spanattributeextractionruleconfig"
        # The length of the entries in the auth_permission table were too long with the auto-generated verbose name,
        # therefore we override it with a shorter string despite being less legible.
        verbose_name = "SpanAttrConfig"

    @classmethod
    def from_dict(
        cls, dictionary: dict[str, Any], user_id: int, project: Project
    ) -> SpanAttributeExtractionRuleConfig:
        config = SpanAttributeExtractionRuleConfig()
        config.created_by_id = user_id
        config.project = project
        config.span_attribute = dictionary["spanAttribute"]
        config.aggregates = dictionary["aggregates"]
        config.unit = (
            HARD_CODED_UNITS.get(dictionary["spanAttribute"], dictionary["unit"]) or "none"
        )
        config.tags = dictionary["tags"]
        config.save()

        for condition in dictionary["conditions"]:
            SpanAttributeExtractionRuleCondition.objects.create(
                created_by_id=user_id,
                value=condition["value"],
                config=config,
            )
        return config
