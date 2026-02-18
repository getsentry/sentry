from __future__ import annotations

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.fields.jsonfield import JSONField


class DashboardHistorySource:
    EDIT = "edit"
    RESTORE = "restore"


@region_silo_model
class DashboardHistory(Model):
    """
    Stores a snapshot of a dashboard's full state (title, widgets, queries,
    layouts, filters, projects) captured before each edit.  Used for
    viewing history and restoring previous versions.
    """

    __relocation_scope__ = RelocationScope.Organization

    dashboard = FlexibleForeignKey("sentry.Dashboard", on_delete=models.CASCADE)
    organization = FlexibleForeignKey("sentry.Organization")
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    date_added = models.DateTimeField(default=timezone.now)
    title = models.CharField(max_length=255)
    source = models.CharField(max_length=32, default=DashboardHistorySource.EDIT)
    snapshot: models.Field[dict | None, dict | None] = JSONField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardhistory"
        indexes = [
            models.Index(fields=["dashboard", "-date_added"]),
        ]
