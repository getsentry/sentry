from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.db.models.fields.jsonfield import JSONField


@region_silo_only_model
class DashboardProject(Model):
    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project")
    dashboard = FlexibleForeignKey("sentry.Dashboard")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardproject"
        unique_together = (("project", "dashboard"),)


@region_silo_only_model
class Dashboard(Model):
    """
    A dashboard.
    """

    __include_in_export__ = True

    title = models.CharField(max_length=255)
    created_by = FlexibleForeignKey("sentry.User")
    organization = FlexibleForeignKey("sentry.Organization")
    date_added = models.DateTimeField(default=timezone.now)
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)
    projects = models.ManyToManyField("sentry.Project", through=DashboardProject)
    filters = JSONField(null=True)

    MAX_WIDGETS = 30

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboard"
        unique_together = (("organization", "title"),)

    __repr__ = sane_repr("organization", "title")

    @staticmethod
    def get_prebuilt_list(organization, title_query=None):
        query = list(
            DashboardTombstone.objects.filter(organization=organization).values_list("slug")
        )
        tombstones = [v[0] for v in query]
        results = []
        for data in PREBUILT_DASHBOARDS.values():
            if title_query and title_query.lower() not in data["title"].lower():
                continue
            if data["id"] not in tombstones:
                results.append(data)
        return results

    @staticmethod
    def get_prebuilt(dashboard_id):
        if dashboard_id in PREBUILT_DASHBOARDS:
            return PREBUILT_DASHBOARDS[dashboard_id]
        return None


@region_silo_only_model
class DashboardTombstone(Model):
    """
    A tombstone to indicate that a pre-built dashboard
    has been replaced or deleted for an organization.
    """

    __include_in_export__ = True

    slug = models.CharField(max_length=255)
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
PREBUILT_DASHBOARDS = {
    item["id"]: item
    for item in [
        {
            # This should match the general template in static/app/views/dashboardsV2/data.tsx
            "id": "default-overview",
            "title": "General",
            "dateCreated": "",
            "createdBy": "",
            "widgets": [
                {
                    "title": "Number of Errors",
                    "displayType": "big_number",
                    "interval": "5m",
                    "widgetType": "discover",
                    "queries": [
                        {
                            "name": "",
                            "conditions": "!event.type:transaction",
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
                    "widgetType": "discover",
                    "queries": [
                        {
                            "name": "",
                            "conditions": "!event.type:transaction",
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
                    "widgetType": "discover",
                    "queries": [
                        {
                            "name": "Events",
                            "conditions": "!event.type:transaction",
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
                    "widgetType": "discover",
                    "queries": [
                        {
                            "name": "Known Users",
                            "conditions": "has:user.email !event.type:transaction",
                            "fields": ["count_unique(user)"],
                            "aggregates": ["count_unique(user)"],
                            "columns": [],
                            "orderby": "",
                        },
                        {
                            "name": "Anonymous Users",
                            "conditions": "!has:user.email !event.type:transaction",
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
                    "widgetType": "discover",
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
                    "displayType": "world_map",
                    "interval": "5m",
                    "widgetType": "discover",
                    "queries": [
                        {
                            "name": "Error counts",
                            "conditions": "!event.type:transaction has:geo.country_code",
                            "fields": ["count()"],
                            "aggregates": ["count()"],
                            "columns": [],
                            "orderby": "",
                        }
                    ],
                },
                {
                    "title": "Errors by Browser",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": "discover",
                    "queries": [
                        {
                            "name": "",
                            "conditions": "!event.type:transaction has:browser.name",
                            "fields": ["browser.name", "count()"],
                            "aggregates": ["count()"],
                            "columns": ["browser.name"],
                            "orderby": "-count",
                        }
                    ],
                },
                {
                    "title": "High Throughput Transactions",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": "discover",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()", "transaction"],
                            "aggregates": ["count()"],
                            "columns": ["transaction"],
                            "conditions": "event.type:transaction",
                            "orderby": "-count()",
                        },
                    ],
                },
                {
                    "title": "Overall User Misery",
                    "displayType": "big_number",
                    "interval": "5m",
                    "widgetType": "discover",
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
                    "widgetType": "discover",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["transaction", "count()"],
                            "aggregates": ["count()"],
                            "columns": ["transaction"],
                            "conditions": "event.type:transaction",
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
                            "orderby": "priority",
                        },
                    ],
                    "widgetType": "issue",
                },
                {
                    "title": "Transactions Ordered by Misery",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": "discover",
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
}
