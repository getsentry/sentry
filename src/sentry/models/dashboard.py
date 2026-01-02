from __future__ import annotations

import re
from typing import Any, ClassVar

import sentry_sdk
from django.db import models, router, transaction
from django.db.models import CheckConstraint, Q, UniqueConstraint
from django.db.models.query import QuerySet
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.constants import ALL_ACCESS_PROJECT_ID
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedBigIntegerField, BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.fields.jsonfield import JSONField
from sentry.db.models.fields.slug import SentrySlugField
from sentry.db.models.manager.base import BaseManager
from sentry.models.dashboard_widget import DashboardWidgetTypes
from sentry.models.organization import Organization


@region_silo_model
class DashboardProject(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    dashboard = FlexibleForeignKey("sentry.Dashboard")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardproject"
        unique_together = (("project", "dashboard"),)


class DashboardFavoriteUserManager(BaseManager["DashboardFavoriteUser"]):
    def get_last_position(self, organization: Organization, user_id: int) -> int:
        """
        Returns the last position of a user's favorited dashboards in an organization.
        """
        last_favorite_dashboard = (
            self.filter(
                organization=organization,
                user_id=user_id,
                position__isnull=False,
            )
            .order_by("-position")
            .first()
        )
        if last_favorite_dashboard and last_favorite_dashboard.position is not None:
            return last_favorite_dashboard.position
        return 0

    def get_favorite_dashboards(
        self, organization: Organization, user_id: int
    ) -> QuerySet[DashboardFavoriteUser]:
        """
        Returns all favorited dashboards for a user in an organization.
        """
        return self.filter(organization=organization, user_id=user_id).order_by(
            "position", "dashboard__title"
        )

    def get_favorite_dashboard(
        self, organization: Organization, user_id: int, dashboard: Dashboard
    ) -> DashboardFavoriteUser | None:
        """
        Returns the favorite dashboard if it exists, otherwise None.
        """
        return self.filter(organization=organization, user_id=user_id, dashboard=dashboard).first()

    def reorder_favorite_dashboards(
        self, organization: Organization, user_id: int, new_dashboard_positions: list[int]
    ):
        """
        Reorders the positions of favorited dashboards for a user in an organization.
        Does NOT add or remove favorited dashboards.

        Args:
            organization: The organization the dashboards belong to
            user_id: The ID of the user whose favorited dashboards are being reordered
            new_dashboard_positions: List of dashboard IDs in their new order

        Raises:
            ValueError: If there's a mismatch between existing favorited dashboards and the provided list
        """
        existing_favorite_dashboards = self.filter(
            organization=organization,
            user_id=user_id,
        )

        existing_dashboard_ids = {
            favorite.dashboard.id for favorite in existing_favorite_dashboards
        }
        new_dashboard_ids = set(new_dashboard_positions)

        sentry_sdk.set_context(
            "reorder_favorite_dashboards",
            {
                "organization": organization.id,
                "user_id": user_id,
                "existing_dashboard_ids": existing_dashboard_ids,
                "new_dashboard_positions": new_dashboard_positions,
            },
        )

        if existing_dashboard_ids != new_dashboard_ids:
            raise ValueError("Mismatch between existing and provided favorited dashboards.")

        position_map = {
            dashboard_id: idx for idx, dashboard_id in enumerate(new_dashboard_positions)
        }

        favorites_to_update = list(existing_favorite_dashboards)

        for favorite in favorites_to_update:
            favorite.position = position_map[favorite.dashboard.id]

        with transaction.atomic(using=router.db_for_write(DashboardFavoriteUser)):
            if favorites_to_update:
                self.bulk_update(favorites_to_update, ["position"])

    def insert_favorite_dashboard(
        self,
        organization: Organization,
        user_id: int,
        dashboard: Dashboard,
    ) -> bool:
        """
        Inserts a new favorited dashboard at the end of the list.

        Args:
            organization: The organization the dashboards belong to
            user_id: The ID of the user whose favorited dashboards are being updated
            dashboard: The dashboard to insert

        Returns:
            True if the dashboard was favorited, False if the dashboard was already favorited
        """
        with transaction.atomic(using=router.db_for_write(DashboardFavoriteUser)):
            if self.get_favorite_dashboard(organization, user_id, dashboard):
                return False

            if self.count() == 0:
                position = 0
            else:
                position = self.get_last_position(organization, user_id) + 1

            self.create(
                organization=organization,
                user_id=user_id,
                dashboard=dashboard,
                position=position,
            )
            return True

    def delete_favorite_dashboard(
        self, organization: Organization, user_id: int, dashboard: Dashboard
    ) -> bool:
        """
        Deletes a favorited dashboard from the list.
        Decrements the position of all dashboards after the deletion point.

        Args:
            organization: The organization the dashboards belong to
            user_id: The ID of the user whose favorited dashboards are being updated
            dashboard: The dashboard to delete

        Returns:
            True if the dashboard was unfavorited, False if the dashboard was already unfavorited
        """
        with transaction.atomic(using=router.db_for_write(DashboardFavoriteUser)):
            if not (favorite := self.get_favorite_dashboard(organization, user_id, dashboard)):
                return False

            deleted_position = favorite.position
            favorite.delete()

            self.filter(
                organization=organization, user_id=user_id, position__gt=deleted_position
            ).update(position=models.F("position") - 1)
            return True


@region_silo_model
class DashboardFavoriteUser(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    dashboard = FlexibleForeignKey("sentry.Dashboard", on_delete=models.CASCADE)

    position = models.PositiveSmallIntegerField(null=True)

    objects: ClassVar[DashboardFavoriteUserManager] = DashboardFavoriteUserManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardfavoriteuser"
        constraints = [
            # A user can only favorite a dashboard once
            UniqueConstraint(
                fields=["user_id", "dashboard"],
                name="sentry_dashboardfavoriteuser_user_id_dashboard_id_2c7267a5_uniq",
            ),
            # A user can only have one starred dashboard in a specific position
            UniqueConstraint(
                fields=["user_id", "organization_id", "position"],
                name="sentry_dashboardfavoriteuser_user_org_position_uniq_deferred",
                deferrable=models.Deferrable.DEFERRED,
            ),
        ]


@region_silo_model
class Dashboard(Model):
    """
    A dashboard.
    """

    __relocation_scope__ = RelocationScope.Organization

    title = models.CharField(max_length=255)
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    date_added = models.DateTimeField(default=timezone.now)
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)
    projects = models.ManyToManyField("sentry.Project", through=DashboardProject)
    filters: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)
    prebuilt_id = BoundedPositiveIntegerField(null=True, db_default=None)

    MAX_WIDGETS = 30

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboard"
        constraints = [
            # User-created dashboards must have unique titles within an organization, but a prebuilt one can exist with the same title
            UniqueConstraint(
                fields=["organization", "title"],
                condition=Q(prebuilt_id__isnull=True),
                name="sentry_dashboard_organization_title_uniq",
            ),
            UniqueConstraint(
                fields=["organization", "prebuilt_id"],
                condition=Q(prebuilt_id__isnull=False),
                name="sentry_dashboard_organization_prebuilt_id_uniq",
            ),
            # prebuilt dashboards cannot have a created_by_id
            CheckConstraint(
                condition=Q(prebuilt_id__isnull=True) | Q(created_by_id__isnull=True),
                name="sentry_dashboard_prebuilt_null_created_by",
            ),
        ]

    __repr__ = sane_repr("organization", "title")

    @property
    def favorited_by(self):
        """
        @deprecated Use the DashboardFavoriteUser object manager instead.
        """
        user_ids = DashboardFavoriteUser.objects.filter(dashboard=self).values_list(
            "user_id", flat=True
        )
        return user_ids

    @favorited_by.setter
    def favorited_by(self, user_ids):
        """
        @deprecated Use the DashboardFavoriteUser object manager instead.
        """
        from django.db import router, transaction

        existing_user_ids = DashboardFavoriteUser.objects.filter(dashboard=self).values_list(
            "user_id", flat=True
        )
        with transaction.atomic(using=router.db_for_write(DashboardFavoriteUser)):
            newly_favourited = [
                DashboardFavoriteUser(
                    dashboard=self, user_id=user_id, organization=self.organization
                )
                for user_id in set(user_ids) - set(existing_user_ids)
            ]
            DashboardFavoriteUser.objects.filter(
                dashboard=self, user_id__in=set(existing_user_ids) - set(user_ids)
            ).delete()
            DashboardFavoriteUser.objects.bulk_create(newly_favourited)

    @staticmethod
    def get_prebuilt_list(organization, user, title_query=None):
        query = list(
            DashboardTombstone.objects.filter(organization=organization).values_list("slug")
        )
        tombstones = [v[0] for v in query]
        results = []

        # Needs to pass along organization to get the right dataset
        for data in get_all_prebuilt_dashboards(organization, user).values():
            if title_query and title_query.lower() not in data["title"].lower():
                continue
            if data["id"] not in tombstones:
                results.append(data)
        return results

    @staticmethod
    def get_prebuilt(organization, user, dashboard_id):
        all_prebuilt_dashboards = get_all_prebuilt_dashboards(organization, user)
        if dashboard_id in all_prebuilt_dashboards:
            return all_prebuilt_dashboards[dashboard_id]
        return None

    @classmethod
    def incremental_title(cls, organization, name):
        """
        Given a dashboard name that migh already exist, returns a new unique name that does not exist, by appending the word "copy" and an integer if necessary.
        """

        base_name = re.sub(r" ?copy ?(\d+)?$", "", name)
        matching_dashboards = cls.objects.filter(
            organization=organization, title__regex=rf"^{re.escape(base_name)} ?(copy)? ?(\d+)?$"
        ).values("title")

        if not matching_dashboards:
            return name

        next_copy_number = 0
        for dashboard in matching_dashboards:
            match = re.search(r" copy ?(\d+)?", dashboard["title"])
            if match:
                copy_number = int(match.group(1) or 0)
                next_copy_number = max(next_copy_number, copy_number + 1)

        if next_copy_number == 0:
            return f"{base_name} copy"

        return f"{base_name} copy {next_copy_number}"

    def get_filters(self) -> dict[str, Any]:
        """
        Returns the filters for the dashboard.

        This is used to colocate any specific logic for producing dashboard filters,
        such as handling the all_projects filter.
        """
        projects = (
            [ALL_ACCESS_PROJECT_ID]
            if self.filters and self.filters.get("all_projects")
            else list(self.projects.values_list("id", flat=True))
        )

        return {
            **(self.filters or {}),
            "projects": projects,
        }


@region_silo_model
class DashboardTombstone(Model):
    """
    A tombstone to indicate that a pre-built dashboard
    has been replaced or deleted for an organization.
    """

    __relocation_scope__ = RelocationScope.Organization

    slug = SentrySlugField(max_length=255, db_index=False)
    organization = FlexibleForeignKey("sentry.Organization")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardtombstone"
        unique_together = (("organization", "slug"),)

    __repr__ = sane_repr("organization", "slug")


@region_silo_model
class DashboardLastVisited(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    dashboard = FlexibleForeignKey("sentry.Dashboard", on_delete=models.CASCADE)
    member = FlexibleForeignKey("sentry.OrganizationMember", on_delete=models.CASCADE)

    last_visited = models.DateTimeField(null=False, default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardlastvisited"
        constraints = [
            UniqueConstraint(
                fields=["member_id", "dashboard_id"],
                name="sentry_dashboardlastvisited_unique_last_visited_per_org_member",
            )
        ]


# Prebuilt dashboards are added to API responses for all accounts that have
# not added a tombstone for the id value. If you change the id of a prebuilt dashboard
# it will invalidate all the tombstone records that already exist.
#
# All widgets and queries in prebuilt dashboards must not have id attributes defined,
# or users will be unable to 'update' them with a forked version.


def get_prebuilt_dashboards(organization, user) -> list[dict[str, Any]]:
    error_events_type = DashboardWidgetTypes.get_type_name(DashboardWidgetTypes.ERROR_EVENTS)
    transaction_type = DashboardWidgetTypes.get_type_name(DashboardWidgetTypes.TRANSACTION_LIKE)
    return [
        {
            # This should match the general template in static/app/views/dashboardsV2/data.tsx
            "id": "default-overview",
            "title": "General",
            "dateCreated": "",
            "createdBy": "",
            "permissions": {"isEditableByEveryone": True, "teamsWithEditAccess": []},
            "isFavorited": False,
            "projects": [],
            "widgets": [
                {
                    "title": "Number of Errors",
                    "displayType": "big_number",
                    "interval": "5m",
                    "widgetType": error_events_type,
                    "queries": [
                        {
                            "name": "",
                            "conditions": "",
                            "fields": ["count()"],
                            "aggregates": ["count()"],
                            "columns": [],
                            "orderby": "",
                        }
                    ],
                },
                {
                    "title": "Number of Issues",
                    "displayType": "big_number",
                    "interval": "5m",
                    "widgetType": error_events_type,
                    "queries": [
                        {
                            "name": "",
                            "conditions": "",
                            "fields": ["count_unique(issue)"],
                            "aggregates": ["count_unique(issue)"],
                            "columns": [],
                            "orderby": "",
                        }
                    ],
                },
                {
                    "title": "Events",
                    "displayType": "line",
                    "interval": "5m",
                    "widgetType": error_events_type,
                    "queries": [
                        {
                            "name": "Events",
                            "conditions": "",
                            "fields": ["count()"],
                            "aggregates": ["count()"],
                            "columns": [],
                            "orderby": "",
                        }
                    ],
                },
                {
                    "title": "Affected Users",
                    "displayType": "line",
                    "interval": "5m",
                    "widgetType": error_events_type,
                    "queries": [
                        {
                            "name": "Known Users",
                            "conditions": "has:user.email",
                            "fields": ["count_unique(user)"],
                            "aggregates": ["count_unique(user)"],
                            "columns": [],
                            "orderby": "",
                        },
                        {
                            "name": "Anonymous Users",
                            "conditions": "!has:user.email",
                            "fields": ["count_unique(user)"],
                            "aggregates": ["count_unique(user)"],
                            "columns": [],
                            "orderby": "",
                        },
                    ],
                },
                {
                    "title": "Handled vs. Unhandled",
                    "displayType": "line",
                    "interval": "5m",
                    "widgetType": error_events_type,
                    "queries": [
                        {
                            "name": "Handled",
                            "conditions": "error.handled:true",
                            "fields": ["count()"],
                            "aggregates": ["count()"],
                            "columns": [],
                            "orderby": "",
                        },
                        {
                            "name": "Unhandled",
                            "conditions": "error.handled:false",
                            "fields": ["count()"],
                            "aggregates": ["count()"],
                            "columns": [],
                            "orderby": "",
                        },
                    ],
                },
                {
                    "title": "Errors by Country",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": error_events_type,
                    "queries": [
                        {
                            "name": "Error counts",
                            "conditions": "has:geo.country_code",
                            "fields": ["geo.country_code", "geo.region", "count()"],
                            "aggregates": ["count()"],
                            "columns": ["geo.country_code", "geo.region"],
                            "orderby": "-count()",
                        }
                    ],
                },
                {
                    "title": "Errors by Browser",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": error_events_type,
                    "queries": [
                        {
                            "name": "",
                            "conditions": "has:browser.name",
                            "fields": ["browser.name", "count()"],
                            "aggregates": ["count()"],
                            "columns": ["browser.name"],
                            "orderby": "-count()",
                        }
                    ],
                },
                {
                    "title": "High Throughput Transactions",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": transaction_type,
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()", "transaction"],
                            "aggregates": ["count()"],
                            "columns": ["transaction"],
                            "conditions": "",
                            "orderby": "-count()",
                        },
                    ],
                },
                {
                    "title": "Overall User Misery",
                    "displayType": "big_number",
                    "interval": "5m",
                    "widgetType": transaction_type,
                    "queries": [
                        {
                            "name": "",
                            "fields": ["user_misery(300)"],
                            "aggregates": ["user_misery(300)"],
                            "columns": [],
                            "conditions": "",
                            "orderby": "",
                        },
                    ],
                },
                {
                    "title": "High Throughput Transactions",
                    "displayType": "top_n",
                    "interval": "5m",
                    "widgetType": transaction_type,
                    "queries": [
                        {
                            "name": "",
                            "fields": ["transaction", "count()"],
                            "aggregates": ["count()"],
                            "columns": ["transaction"],
                            "conditions": "",
                            "orderby": "-count()",
                        },
                    ],
                },
                {
                    "title": "Issues Assigned to Me or My Teams",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["assignee", "issue", "title"],
                            "aggregates": [],
                            "columns": ["assignee", "issue", "title"],
                            "conditions": "assigned_or_suggested:me is:unresolved",
                            "orderby": "trends",
                        },
                    ],
                    "widgetType": "issue",
                },
                {
                    "title": "Transactions Ordered by Misery",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": transaction_type,
                    "queries": [
                        {
                            "name": "",
                            "fields": ["transaction", "user_misery(300)"],
                            "aggregates": ["user_misery(300)"],
                            "columns": ["transaction"],
                            "conditions": "",
                            "orderby": "-user_misery(300)",
                        },
                    ],
                },
            ],
        }
    ]


def get_all_prebuilt_dashboards(organization, user):
    return {item["id"]: item for item in get_prebuilt_dashboards(organization, user)}
