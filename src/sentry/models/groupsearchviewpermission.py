from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


@region_silo_model
class GroupSearchViewPermissionTeam(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    team = FlexibleForeignKey("sentry.Team", on_delete=models.CASCADE)
    permissions = FlexibleForeignKey("sentry.GroupSearchViewPermission", on_delete=models.CASCADE)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupsearchviewpermissionteam"
        unique_together = (("team", "permissions"),)


@region_silo_model
class GroupSearchViewPermission(DefaultFieldsModel):
    """
    Controls which teams have access to a specific group search view and editing permissions.
    """

    __relocation_scope__ = RelocationScope.Organization

    is_editable_by_everyone = models.BooleanField(
        default=False,
    )

    teams_with_edit_access = models.ManyToManyField(
        "sentry.Team",
        through=GroupSearchViewPermissionTeam,
        blank=True,
    )

    groupsearchview = models.OneToOneField(
        "sentry.GroupSearchView",
        on_delete=models.CASCADE,
        related_name="permissions",
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupsearchviewpermission"
