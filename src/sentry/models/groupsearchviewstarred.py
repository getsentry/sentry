from typing import ClassVar

from django.db import models
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.models.organization import Organization


class GroupSearchViewStarredManager(BaseManager["GroupSearchViewStarred"]):
    def reorder_starred_views(
        self, organization: Organization, user_id: int, new_view_positions: list[int]
    ):
        """
        Reorders the positions of starred views for a user in an organization.
        Does NOT add or remove starred views.

        Args:
            organization: The organization the views belong to
            user_id: The ID of the user whose starred views are being reordered
            new_view_positions: List of view IDs in their new order

        Raises:
            ValueError: If there's a mismatch between existing starred views and the provided list
        """
        existing_starred_views = self.filter(
            organization=organization,
            user_id=user_id,
        )

        existing_view_ids = {view.group_search_view_id for view in existing_starred_views}
        new_view_ids = set(new_view_positions)

        if existing_view_ids != new_view_ids:
            raise ValueError("Mismatch between existing and provided starred views.")

        position_map = {view_id: idx for idx, view_id in enumerate(new_view_positions)}

        views_to_update = list(existing_starred_views)

        for view in views_to_update:
            view.position = position_map[view.group_search_view_id]

        if views_to_update:
            self.bulk_update(views_to_update, ["position"])


@region_silo_model
class GroupSearchViewStarred(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    group_search_view = FlexibleForeignKey("sentry.GroupSearchView")

    position = models.PositiveSmallIntegerField()

    objects: ClassVar[GroupSearchViewStarredManager] = GroupSearchViewStarredManager()

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
