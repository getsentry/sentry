from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_model
from sentry.db.models.base import sane_repr


@region_silo_model
class DashboardPermissions(Model):
    """
    Edit permissions for a Dashboard.
    """

    __relocation_scope__ = RelocationScope.Organization

    is_creator_only_editable = models.BooleanField(default=False)
    dashboard = models.OneToOneField(
        "sentry.Dashboard", on_delete=models.CASCADE, related_name="permissions"
    )

    def has_edit_permissions(self, userId):
        if not self.is_creator_only_editable:
            return True
        return userId == self.dashboard.created_by_id

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardpermissions"

    __repr__ = sane_repr("is_creator_only_editable")
