from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_model
class InsightsStarredTransaction(DefaultFieldsModel):
    """
    A starred transaction in Insights
    """

    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    transaction_name = models.CharField(max_length=255)

    class Meta:
        app_label = "insights"
        db_table = "insights_starred_transactions"

    __repr__ = sane_repr("organization_id", "user_id", "transaction_name")
