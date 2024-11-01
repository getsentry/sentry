from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model
from sentry.db.models.base import sane_repr


@region_silo_model
class DashboardPermissionsTeam(Model):
    __relocation_scope__ = RelocationScope.Excluded

    team = FlexibleForeignKey("sentry.Team")
    permissions = FlexibleForeignKey("sentry.DashboardPermissions")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardpermissionsteam"
        unique_together = (("team", "permissions"),)


@region_silo_model
class DashboardPermissions(Model):
    """
    Edit permissions for a Dashboard.
    """

    __relocation_scope__ = RelocationScope.Organization

    is_creator_only_editable = models.BooleanField(default=False)
    is_editable_by_everyone = models.BooleanField(default=True)
    teams_with_edit_access = models.ManyToManyField(
        "sentry.Team", through=DashboardPermissionsTeam, blank=True
    )

    dashboard = models.OneToOneField(
        "sentry.Dashboard", on_delete=models.CASCADE, related_name="permissions"
    )

    def has_edit_permissions(self, userId):
        if self.is_editable_by_everyone:
            return True
        if userId == self.dashboard.created_by_id:
            return True  # Dashboard creator will always have edit perms
        for team in self.teams_with_edit_access.all():
            if userId in team.get_member_user_ids():
                return True
        return False

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardpermissions"

    __repr__ = sane_repr("is_editable_by_everyone")
