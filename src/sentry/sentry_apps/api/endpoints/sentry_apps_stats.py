from django.db.models import Count
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.permissions import SuperuserOrStaffFeatureFlaggedPermission
from sentry.api.serializers import serialize
from sentry.sentry_apps.api.bases.sentryapps import SentryAppsBaseEndpoint
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar


@control_silo_endpoint
class SentryAppsStatsEndpoint(SentryAppsBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def get(self, request: Request) -> Response:
        sentry_apps = (
            SentryApp.objects.filter(installations__date_deleted=None)
            .annotate(installations__count=Count("installations"))
            .order_by("-installations__count")
        )

        if "per_page" in request.query_params:
            sentry_apps = sentry_apps[: int(request.query_params["per_page"])]

        avatars_to_app_map = SentryAppAvatar.objects.get_by_apps_as_dict(sentry_apps=sentry_apps)
        apps = [
            {
                "id": app.id,
                "uuid": app.uuid,
                "slug": app.slug,
                "name": app.name,
                "installs": app.installations__count,
                "avatars": serialize(avatars_to_app_map[app.id], request.user),
            }
            for app in sentry_apps
        ]

        return Response(apps)
