from __future__ import annotations

from typing import Any, ClassVar

from django.db import models, router, transaction
from django.db.models import UniqueConstraint
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields import JSONField
from sentry.db.models.fields.bounded import BoundedBigIntegerField, BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.models.dashboard_widget import TypesClass
from sentry.models.organization import Organization


class ExploreSavedQueryDataset(TypesClass):
    SPANS = 0
    OURLOGS = 1

    TYPES = [
        (SPANS, "spans"),
        (OURLOGS, "ourlogs"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


@region_silo_model
class ExploreSavedQueryProject(Model):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project")
    explore_saved_query = FlexibleForeignKey("explore.ExploreSavedQuery")

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedqueryproject"
        unique_together = (("project", "explore_saved_query"),)


@region_silo_model
class ExploreSavedQuery(DefaultFieldsModel):
    """
    A saved Explore query
    """

    __relocation_scope__ = RelocationScope.Organization

    projects = models.ManyToManyField("sentry.Project", through=ExploreSavedQueryProject)
    organization = FlexibleForeignKey("sentry.Organization")
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    name = models.CharField(max_length=255)
    query: models.Field[dict[str, Any], dict[str, Any]] = JSONField()
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)
    dataset = BoundedPositiveIntegerField(
        choices=ExploreSavedQueryDataset.as_choices(), default=ExploreSavedQueryDataset.SPANS
    )
    is_multi_query = models.BooleanField(default=False)

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedquery"

    __repr__ = sane_repr("organization_id", "created_by_id", "name")

    def set_projects(self, project_ids):
        with transaction.atomic(router.db_for_write(ExploreSavedQueryProject)):
            ExploreSavedQueryProject.objects.filter(explore_saved_query=self).exclude(
                project__in=project_ids
            ).delete()

            existing_project_ids = ExploreSavedQueryProject.objects.filter(
                explore_saved_query=self
            ).values_list("project", flat=True)

            new_project_ids = sorted(set(project_ids) - set(existing_project_ids))

            ExploreSavedQueryProject.objects.bulk_create(
                [
                    ExploreSavedQueryProject(project_id=project_id, explore_saved_query=self)
                    for project_id in new_project_ids
                ]
            )


class ExploreSavedQueryStarredManager(BaseManager["ExploreSavedQueryStarred"]):

    def get_last_position(self, organization: Organization, user_id: int) -> int:
        """
        Returns the last position of a user's starred queries in an organization.
        """
        last_starred_query = (
            self.filter(organization=organization, user_id=user_id).order_by("-position").first()
        )
        if last_starred_query:
            return last_starred_query.position
        return 0

    def get_starred_query(
        self, organization: Organization, user_id: int, query: ExploreSavedQuery
    ) -> ExploreSavedQueryStarred | None:
        """
        Returns the starred query if it exists, otherwise None.
        """
        return self.filter(
            organization=organization, user_id=user_id, explore_saved_query=query
        ).first()

    def reorder_starred_queries(
        self, organization: Organization, user_id: int, new_query_positions: list[int]
    ):
        """
        Reorders the positions of starred queries for a user in an organization.
        Does NOT add or remove starred queries.

        Args:
            organization: The organization the queries belong to
            user_id: The ID of the user whose starred queries are being reordered
            new_query_positions: List of query IDs in their new order

        Raises:
            ValueError: If there's a mismatch between existing starred queries and the provided list
        """
        existing_starred_queries = self.filter(
            organization=organization,
            user_id=user_id,
        )

        existing_query_ids = {query.explore_saved_query.id for query in existing_starred_queries}
        new_query_ids = set(new_query_positions)

        if existing_query_ids != new_query_ids:
            raise ValueError("Mismatch between existing and provided starred queries.")

        position_map = {query_id: idx for idx, query_id in enumerate(new_query_positions)}

        queries_to_update = list(existing_starred_queries)

        for query in queries_to_update:
            query.position = position_map[query.explore_saved_query.id]

        if queries_to_update:
            self.bulk_update(queries_to_update, ["position"])

    def insert_starred_query(
        self,
        organization: Organization,
        user_id: int,
        query: ExploreSavedQuery,
    ) -> bool:
        """
        Inserts a new starred query at the end of the list.

        Args:
            organization: The organization the queries belong to
            user_id: The ID of the user whose starred queries are being updated
            explore_saved_query: The query to insert

        Returns:
            True if the query was starred, False if the query was already starred
        """
        with transaction.atomic(using=router.db_for_write(ExploreSavedQueryStarred)):
            if self.get_starred_query(organization, user_id, query):
                return False

            position = self.get_last_position(organization, user_id) + 1

            self.create(
                organization=organization,
                user_id=user_id,
                explore_saved_query=query,
                position=position,
            )
            return True

    def delete_starred_query(
        self, organization: Organization, user_id: int, query: ExploreSavedQuery
    ) -> bool:
        """
        Deletes a starred query from the list.
        Decrements the position of all queries after the deletion point.

        Args:
            organization: The organization the queries belong to
            user_id: The ID of the user whose starred queries are being updated
            explore_saved_query: The query to delete

        Returns:
            True if the query was unstarred, False if the query was already unstarred
        """
        with transaction.atomic(using=router.db_for_write(ExploreSavedQueryStarred)):
            if not (starred_query := self.get_starred_query(organization, user_id, query)):
                return False

            deleted_position = starred_query.position
            starred_query.delete()

            self.filter(
                organization=organization, user_id=user_id, position__gt=deleted_position
            ).update(position=models.F("position") - 1)
            return True


@region_silo_model
class ExploreSavedQueryStarred(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    explore_saved_query = FlexibleForeignKey("explore.ExploreSavedQuery")

    position = models.PositiveSmallIntegerField()

    objects: ClassVar[ExploreSavedQueryStarredManager] = ExploreSavedQueryStarredManager()

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedquerystarred"
        # Two queries cannot occupy the same position in an organization user's list of queries
        constraints = [
            UniqueConstraint(
                fields=["user_id", "organization_id", "position"],
                name="explore_exploresavedquerystarred_unique_query_position_per_org_user",
                deferrable=models.Deferrable.DEFERRED,
            )
        ]
