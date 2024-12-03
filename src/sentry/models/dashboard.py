from __future__ import annotations

import re
from typing import Any

from django.db import models
from django.utils import timezone

from sentry import features
from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.fields.jsonfield import JSONField
from sentry.db.models.fields.slug import SentrySlugField
from sentry.models.dashboard_widget import DashboardWidgetTypes


@region_silo_model
class DashboardProject(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    dashboard = FlexibleForeignKey("sentry.Dashboard")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardproject"
        unique_together = (("project", "dashboard"),)


@region_silo_model
class DashboardFavoriteUser(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    dashboard = FlexibleForeignKey("sentry.Dashboard", on_delete=models.CASCADE)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardfavoriteuser"
        unique_together = (("user_id", "dashboard"),)


@region_silo_model
class Dashboard(Model):
    """
    A dashboard.
    """

    __relocation_scope__ = RelocationScope.Organization

    title = models.CharField(max_length=255)
    created_by_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    date_added = models.DateTimeField(default=timezone.now)
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)
    projects = models.ManyToManyField("sentry.Project", through=DashboardProject)
    filters: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)

    MAX_WIDGETS = 30

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboard"
        unique_together = (("organization", "title"),)

    __repr__ = sane_repr("organization", "title")

    @property
    def favorited_by(self):
        user_ids = DashboardFavoriteUser.objects.filter(dashboard=self).values_list(
            "user_id", flat=True
        )
        return user_ids

    @favorited_by.setter
    def favorited_by(self, user_ids):
        from django.db import router, transaction

        existing_user_ids = DashboardFavoriteUser.objects.filter(dashboard=self).values_list(
            "user_id", flat=True
        )
        with transaction.atomic(using=router.db_for_write(DashboardFavoriteUser)):
            newly_favourited = [
                DashboardFavoriteUser(dashboard=self, user_id=user_id)
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


# Prebuilt dashboards are added to API responses for all accounts that have
# not added a tombstone for the id value. If you change the id of a prebuilt dashboard
# it will invalidate all the tombstone records that already exist.
#
# All widgets and queries in prebuilt dashboards must not have id attributes defined,
# or users will be unable to 'update' them with a forked version.


def get_prebuilt_dashboards(organization, user) -> list[dict[str, Any]]:
    DISCOVER = DashboardWidgetTypes.get_type_name(DashboardWidgetTypes.DISCOVER)
    has_discover_split = features.has(
        "organizations:performance-discover-dataset-selector", organization, actor=user
    )
    error_events_type = (
        DashboardWidgetTypes.get_type_name(DashboardWidgetTypes.ERROR_EVENTS)
        if has_discover_split
        else DISCOVER
    )
    transaction_type = (
        DashboardWidgetTypes.get_type_name(DashboardWidgetTypes.TRANSACTION_LIKE)
        if has_discover_split
        else DISCOVER
    )
    return [
        {
            # This should match the general template in static/app/views/dashboardsV2/data.tsx
            "id": "default-overview",
            "title": "General",
            "dateCreated": "",
            "createdBy": "",
            "permissions": {"isEditableByEveryone": True, "teamsWithEditAccess": []},
            "isFavorited": False,
            "widgets": [
                {
                    "title": "Number of Errors",
                    "displayType": "big_number",
                    "interval": "5m",
                    "widgetType": error_events_type,
                    "queries": [
                        {
                            "name": "",
                            "conditions": "" if has_discover_split else "!event.type:transaction",
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
                            "conditions": "" if has_discover_split else "!event.type:transaction",
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
                            "conditions": "" if has_discover_split else "!event.type:transaction",
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
                            "conditions": (
                                "has:user.email"
                                if has_discover_split
                                else "has:user.email !event.type:transaction"
                            ),
                            "fields": ["count_unique(user)"],
                            "aggregates": ["count_unique(user)"],
                            "columns": [],
                            "orderby": "",
                        },
                        {
                            "name": "Anonymous Users",
                            "conditions": (
                                "!has:user.email"
                                if has_discover_split
                                else "!has:user.email !event.type:transaction"
                            ),
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
                            "conditions": (
                                "has:geo.country_code"
                                if has_discover_split
                                else "has:geo.country_code !event.type:transaction"
                            ),
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
                            "conditions": (
                                "has:browser.name"
                                if has_discover_split
                                else "has:browser.name !event.type:transaction"
                            ),
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
                            "conditions": "" if has_discover_split else "event.type:transaction",
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
                            "conditions": "" if has_discover_split else "event.type:transaction",
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
