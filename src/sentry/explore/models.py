from __future__ import annotations

from typing import ClassVar

from django.db import models, router, transaction
from django.db.models import UniqueConstraint
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedBigIntegerField, BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.models.dashboard_widget import TypesClass
from sentry.models.organization import Organization


class ExploreSavedQueryDataset(TypesClass):
    SPANS = 0
    OURLOGS = 1
    METRICS = 2
    REPLAYS = 3
    # This is a temporary dataset to be used for the discover -> explore migration.
    # It will track which queries are generated from discover queries.
    SEGMENT_SPANS = 101

    TYPES = [
        (SPANS, "spans"),
        (OURLOGS, "logs"),
        (SEGMENT_SPANS, "segment_spans"),
        (METRICS, "metrics"),
        (REPLAYS, "replays"),
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
class ExploreSavedQueryLastVisited(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    explore_saved_query = FlexibleForeignKey("explore.ExploreSavedQuery")

    last_visited = models.DateTimeField(null=False, default=timezone.now)

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedquerylastvisited"
        constraints = [
            UniqueConstraint(
                fields=["user_id", "organization_id", "explore_saved_query_id"],
                name="explore_exploresavedquerylastvisited_unique_last_visited_per_org_user_query",
            )
        ]


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
    query = models.JSONField()
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)
    dataset = BoundedPositiveIntegerField(
        choices=ExploreSavedQueryDataset.as_choices(), default=ExploreSavedQueryDataset.SPANS
    )
    is_multi_query = models.BooleanField(default=False)
    # The corresponding prebuilt_id found in hardcoded prebuilt queries from src/sentry/explore/endpoints/explore_saved_queries.py
    # If the saved query is not a prebuilt query, this will be None
    prebuilt_id = BoundedPositiveIntegerField(null=True, db_default=None)
    # The version of the prebuilt query. If the version found in the explore_saved_queries.py hardcoded list is greater, then the saved
    # query out of date and should be updated..
    prebuilt_version = BoundedPositiveIntegerField(null=True, db_default=None)
    # This field is to be used for the discover -> explore migration. This contains the reason why any part
    # of the saved query was changed so we can display our reasonings in the UI
    changed_reason = models.JSONField(null=True, default=None)

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedquery"
        unique_together = (("organization", "prebuilt_id"),)

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
            self.filter(
                organization=organization, user_id=user_id, position__isnull=False, starred=True
            )
            .order_by("-position")
            .first()
        )
        if last_starred_query:
            return last_starred_query.position  # type: ignore[return-value]
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
            position__isnull=False,
            starred=True,
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
        starred: bool = True,
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
                starred=starred,
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

    def updated_starred_query(
        self,
        organization: Organization,
        user_id: int,
        query: ExploreSavedQuery,
        starred: bool,
    ) -> bool:
        """
        Updates the starred status of a query.
        """
        with transaction.atomic(using=router.db_for_write(ExploreSavedQueryStarred)):
            if not (starred_query := self.get_starred_query(organization, user_id, query)):
                return False

            starred_query.starred = starred
            if starred:
                starred_query.position = self.get_last_position(organization, user_id) + 1
            else:
                starred_query.position = None

            starred_query.save()
            return True


@region_silo_model
class ExploreSavedQueryStarred(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    explore_saved_query = FlexibleForeignKey("explore.ExploreSavedQuery")

    position = models.PositiveSmallIntegerField(null=True, db_default=None)
    starred = models.BooleanField(db_default=True)

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
