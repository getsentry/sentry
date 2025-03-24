from django.db import models
from django.db.models import UniqueConstraint
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_model
class GroupSearchViewLastVisited(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    group_search_view = FlexibleForeignKey("sentry.GroupSearchView")

    last_visited = models.DateTimeField(null=False, default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupsearchviewlastvisited"
        constraints = [
            UniqueConstraint(
                fields=["user_id", "organization_id", "group_search_view_id"],
                name="sentry_groupsearchviewlastvisited_unique_last_visited_per_org_user_view",
            )
        ]
