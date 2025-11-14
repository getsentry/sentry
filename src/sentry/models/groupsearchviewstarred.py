from __future__ import annotations

from typing import int, ClassVar

from django.db import models, router, transaction
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.organization import Organization


class GroupSearchViewStarredManager(BaseManager["GroupSearchViewStarred"]):
    def num_starred_views(self, organization: Organization, user_id: int) -> int:
        """
        Returns the number of starred views for a user in an organization.
        """
        return self.filter(organization=organization, user_id=user_id).count()

    def get_starred_view(
        self, organization: Organization, user_id: int, view: GroupSearchView
    ) -> GroupSearchViewStarred | None:
        """
        Returns the starred view if it exists, otherwise None.
        """
        return self.filter(
            organization=organization, user_id=user_id, group_search_view=view
        ).first()

    def reorder_starred_views(
        self, organization: Organization, user_id: int, new_view_positions: list[int]
    ) -> None:
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

    def insert_starred_view(
        self,
        organization: Organization,
        user_id: int,
        view: GroupSearchView,
        position: int | None = None,
    ) -> bool:
        """
        Inserts a new starred view into the list at a specific position and
        increments the position of all views after the insertion point.

        If position is not provided, the view is inserted at the end of the list.
        If position is provided, the view is inserted at the specified position.
        If the position is greater than the number of existing starred views,
        the view is inserted at the end of the list.

        Args:
            organization: The organization the views belong to
            user_id: The ID of the user whose starred views are being updated
            view: The view to insert
            position: The position to insert the view at

        Returns:
            True if the view was starred, False if the view was already starred
        """
        with transaction.atomic(using=router.db_for_write(GroupSearchViewStarred)):
            if self.get_starred_view(organization, user_id, view):
                return False

            highest_position = self.num_starred_views(organization, user_id)

            if position is None or position > highest_position:
                position = highest_position

            self.filter(
                organization=organization,
                user_id=user_id,
                position__gte=position,
            ).update(position=models.F("position") + 1)

            self.create(
                organization=organization,
                user_id=user_id,
                group_search_view=view,
                position=position,
            )
            return True

    def delete_starred_view(
        self, organization: Organization, user_id: int, view: GroupSearchView
    ) -> bool:
        """
        Deletes a starred view from the list.
        Decrements the position of all views after the deletion point.

        Args:
            organization: The organization the views belong to
            user_id: The ID of the user whose starred views are being updated
            view: The view to delete

        Returns:
            True if the view was unstarred, False if the view was already unstarred
        """
        with transaction.atomic(using=router.db_for_write(GroupSearchViewStarred)):
            if not (starred_view := self.get_starred_view(organization, user_id, view)):
                return False

            deleted_position = starred_view.position
            starred_view.delete()

            self.filter(
                organization=organization, user_id=user_id, position__gt=deleted_position
            ).update(position=models.F("position") - 1)
            return True

    def clear_starred_view_for_all_members(
        self, organization: Organization, view: GroupSearchView
    ) -> None:
        for starred_view in self.filter(organization=organization, group_search_view=view):
            self.delete_starred_view(organization, starred_view.user_id, view)


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
