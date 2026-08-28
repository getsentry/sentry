from __future__ import annotations

from collections.abc import Collection

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model
from sentry.db.models.base import sane_repr


@cell_silo_model
class DashboardPermissionsTeam(Model):
    __relocation_scope__ = RelocationScope.Organization

    team = FlexibleForeignKey("sentry.Team", on_delete=models.CASCADE)
    permissions = FlexibleForeignKey("sentry.DashboardPermissions", on_delete=models.CASCADE)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardpermissionsteam"
        unique_together = (("team", "permissions"),)


@cell_silo_model
class DashboardPermissions(Model):
    """
    Edit permissions for a Dashboard.
    """

    __relocation_scope__ = RelocationScope.Organization

    is_editable_by_everyone = models.BooleanField(default=True, db_default=True)
    teams_with_edit_access = models.ManyToManyField(
        "sentry.Team", through=DashboardPermissionsTeam, blank=True
    )

    dashboard = models.OneToOneField(
        "sentry.Dashboard", on_delete=models.CASCADE, related_name="permissions"
    )

    def has_edit_permissions(self, *, user_id: int | None, team_ids: Collection[int]) -> bool:
        if self.is_editable_by_everyone:
            return True
        if user_id is not None and user_id == self.dashboard.created_by_id:
            return True  # Dashboard creator will always have edit perms
        return self.teams_with_edit_access.filter(id__in=team_ids).exists()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardpermissions"

    __repr__ = sane_repr("is_editable_by_everyone")
