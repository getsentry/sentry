from __future__ import annotations

from django.db import models
from django.db.models import Q
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@cell_silo_model
class CustomDynamicSamplingRuleProject(Model):
    """
    Many-to-many relationship between a custom dynamic sampling rule and a project.
    """

    __relocation_scope__ = RelocationScope.Organization

    custom_dynamic_sampling_rule = FlexibleForeignKey(
        "sentry.CustomDynamicSamplingRule", on_delete=models.CASCADE
    )
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_customdynamicsamplingruleproject"
        unique_together = (("custom_dynamic_sampling_rule", "project"),)


@cell_silo_model
class CustomDynamicSamplingRule(Model):
    """
    This represents a custom dynamic sampling rule that is created by the user based
    on a query (a.k.a. investigation rule).

    """

    __relocation_scope__ = RelocationScope.Organization

    date_added = models.DateTimeField(default=timezone.now)
    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    projects = models.ManyToManyField(
        "sentry.Project",
        related_name="custom_dynamic_sampling_rules",
        through=CustomDynamicSamplingRuleProject,
    )
    is_active = models.BooleanField(default=True)
    is_org_level = models.BooleanField(default=False)
    rule_id = models.IntegerField(default=0)
    condition = models.TextField()
    sample_rate = models.FloatField(default=0.0)
    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField()
    num_samples = models.IntegerField()
    condition_hash = models.CharField(max_length=40)
    # the raw query field from the request
    query = models.TextField(null=True)
    created_by_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE", null=True, blank=True)
    notification_sent = models.BooleanField(null=True, blank=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_customdynamicsamplingrule"
        indexes = [
            # get active rules for an organization
            models.Index(fields=["organization"], name="org_idx", condition=Q(is_active=True)),
            # get expired rules (that are still marked as active)
            models.Index(fields=["end_date"], name="end_date_idx", condition=Q(is_active=True)),
            # find active rules for a condition
            models.Index(
                fields=["condition_hash"], name="condition_hash_idx", condition=Q(is_active=True)
            ),
        ]
