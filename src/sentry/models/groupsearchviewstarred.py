from django.db import models
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model
from sentry.db.models.base import DefaultFieldsModelExisting
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_model
class GroupSearchViewStarred(DefaultFieldsModelExisting):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    group_search_view = FlexibleForeignKey("sentry.GroupSearchView")

    position = models.PositiveSmallIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupsearchviewstarred"
        # Two views cannot occupy the same position in an organization user's list of views
        constraints = [
            UniqueConstraint(
                fields=["user_id", "organization_id", "position"],
                name="sentry_groupsearchviewstarred_unique_view_position_per_org_user",
                deferrable=models.Deferrable.DEFERRED,
            )
        ]
