from __future__ import annotations

import datetime

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import SuperuserOrStaffFeatureFlaggedPermission
from sentry.api.serializers import serialize
from sentry.constants import SentryAppStatus
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.sentry_apps.api.bases.sentryapps import SentryAppsBaseEndpoint
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar

# Number of days for each period shorthand understood by the ?period param.
_PERIOD_DAYS: dict[str, int | None] = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "all": None,
}

# ORM order_by expressions for the ?sortBy param.
_SORT_FIELDS: dict[str, str] = {
    "installs": "-installs",
    "uninstalls": "-uninstalls",
}


def _period_start(period: str) -> datetime.datetime | None:
    """Return the UTC start of the requested period, or None for all-time."""
    days = _PERIOD_DAYS.get(period)
    if days is None:
        return None
    return timezone.now() - datetime.timedelta(days=days)


@control_silo_endpoint
class SentryAppsStatsEndpoint(SentryAppsBaseEndpoint):
    """
    Return install / uninstall counts for every Sentry App, optionally scoped
    to a time period and filtered by status.

    Query params:
      period   – one of 7d | 30d | 90d | all (default: all)
      sortBy   – installs | uninstalls (default: installs)
      status   – published | all (default: all)
      per_page – max results per page (default: 100)
    """

    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def get(self, request: Request) -> Response:
        period = request.query_params.get("period", "all")
        sort_by = request.query_params.get("sortBy", "installs")
        status_filter = request.query_params.get("status", "")

        since = _period_start(period)

        # Build conditional COUNT annotations.
        #
        # "installs"   counts installation rows created in the period (or ever).
        # "uninstalls" counts rows that were soft-deleted (uninstalled) in the
        # period (or ever).  ParanoidModel keeps deleted rows with date_deleted
        # set, so we query them via the FK directly — no special manager needed.
        if since is not None:
            installs_annotation = Count(
                "installations",
                filter=Q(installations__date_added__gte=since),
            )
            uninstalls_annotation = Count(
                "installations",
                filter=Q(
                    installations__date_deleted__isnull=False,
                    installations__date_deleted__gte=since,
                ),
            )
        else:
            installs_annotation = Count("installations")
            uninstalls_annotation = Count(
                "installations",
                filter=Q(installations__date_deleted__isnull=False),
            )

        queryset = SentryApp.objects.annotate(
            installs=installs_annotation,
            uninstalls=uninstalls_annotation,
        )

        if status_filter == "published":
            queryset = queryset.filter(status=SentryAppStatus.PUBLISHED)

        order = _SORT_FIELDS.get(sort_by, "-installs")
        queryset = queryset.order_by(order)

        def serialize_page(apps: list[SentryApp]) -> list[dict]:
            avatars_map = SentryAppAvatar.objects.get_by_apps_as_dict(sentry_apps=apps)
            org_map = {
                o.id: o
                for o in organization_mapping_service.get_many(
                    organization_ids=[a.owner_id for a in apps if a.owner_id is not None]
                )
            }
            return [
                {
                    "id": app.id,
                    "uuid": app.uuid,
                    "slug": app.slug,
                    "name": app.name,
                    "status": SentryAppStatus.as_str(app.status),
                    "installs": app.installs,
                    "uninstalls": app.uninstalls,
                    "owner": (
                        {"id": org.id, "slug": org.slug}
                        if (org := org_map.get(app.owner_id))
                        else None
                    ),
                    "avatars": serialize(avatars_map[app.id], request.user),
                }
                for app in apps
            ]

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=OffsetPaginator,
            on_results=serialize_page,
        )
