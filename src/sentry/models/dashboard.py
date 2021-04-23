from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class Dashboard(Model):
    """
    A dashboard.
    """

    __core__ = True

    title = models.CharField(max_length=255)
    created_by = FlexibleForeignKey("sentry.User")
    organization = FlexibleForeignKey("sentry.Organization")
    date_added = models.DateTimeField(default=timezone.now)

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


class DashboardTombstone(Model):
    """
    A tombstone to indicate that a pre-built dashboard
    has been replaced or deleted for an organization.
    """

    __core__ = True

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
            "id": "default-overview",
            "title": "Dashboard",
            "dateCreated": "",
            "createdBy": "",
            "widgets": [
                {
                    "title": "Number of Errors",
                    "displayType": "big_number",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "conditions": "!event.type:transaction",
                            "fields": ["count()"],
                        }
                    ],
                },
                {
                    "title": "Number of Issues",
                    "displayType": "big_number",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "conditions": "!event.type:transaction",
                            "fields": ["count_unique(issue)"],
                        }
                    ],
                },
                {
                    "title": "Events",
                    "displayType": "line",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Events",
                            "conditions": "!event.type:transaction",
                            "fields": ["count()"],
                        }
                    ],
                },
                {
                    "title": "Affected Users",
                    "displayType": "line",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Known Users",
                            "conditions": "has:user.email !event.type:transaction",
                            "fields": ["count_unique(user)"],
                        },
                        {
                            "name": "Anonymous Users",
                            "conditions": "!has:user.email !event.type:transaction",
                            "fields": ["count_unique(user)"],
                        },
                    ],
                },
                {
                    "title": "Handled vs. Unhandled",
                    "displayType": "line",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Handled",
                            "conditions": "error.handled:true",
                            "fields": ["count()"],
                        },
                        {
                            "name": "Unhandled",
                            "conditions": "error.handled:false",
                            "fields": ["count()"],
                        },
                    ],
                },
                {
                    "title": "Errors by Country",
                    "displayType": "world_map",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Error counts",
                            "conditions": "!event.type:transaction has:geo.country_code",
                            "fields": ["count()"],
                        }
                    ],
                },
                {
                    "title": "Errors by Browser",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "conditions": "!event.type:transaction has:browser.name",
                            "fields": ["browser.name", "count()"],
                            "orderby": "-count",
                        }
                    ],
                },
            ],
        }
    ]
}
