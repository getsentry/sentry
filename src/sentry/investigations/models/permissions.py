from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import Model


@cell_silo_model
class InvestigationPermissionsTeam(Model):
    __relocation_scope__ = RelocationScope.Organization

    team = FlexibleForeignKey("sentry.Team", on_delete=models.CASCADE)
    permissions = FlexibleForeignKey(
        "investigations.InvestigationPermissions", on_delete=models.CASCADE
    )

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationpermissionsteam"
        constraints = [
            models.UniqueConstraint(
                fields=["team", "permissions"], name="investigation_unique_permission_team"
            )
        ]


@cell_silo_model
class InvestigationPermissions(Model):
    """Dashboard-style edit permissions; investigations remain org-visible."""

    __relocation_scope__ = RelocationScope.Organization

    is_editable_by_everyone = models.BooleanField(default=True, db_default=True)
    teams_with_edit_access = models.ManyToManyField(
        "sentry.Team", through=InvestigationPermissionsTeam, blank=True
    )
    investigation = models.OneToOneField(
        "investigations.Investigation",
        on_delete=models.CASCADE,
        related_name="permissions",
    )

    def has_edit_permissions(self, user_id: int) -> bool:
        if self.is_editable_by_everyone:
            return True
        if user_id == self.investigation.created_by_id:
            return True
        return self.teams_with_edit_access.filter(
            organizationmemberteam__organizationmember__user_id=user_id
        ).exists()

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationpermissions"

    __repr__ = sane_repr("investigation_id", "is_editable_by_everyone")
