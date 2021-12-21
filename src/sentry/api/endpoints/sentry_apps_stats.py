from django.db.models import Count
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases import SentryAppsBaseEndpoint
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.models import SentryApp


class SentryAppsStatsEndpoint(SentryAppsBaseEndpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        sentry_apps = (
            SentryApp.objects.filter(installations__date_deleted=None)
            .annotate(Count("installations"))
            .order_by()
        )

        if "per_page" in request.query_params:
            sentry_apps = sentry_apps[: int(request.query_params["per_page"])]

        apps = [
            {
                "id": app.id,
                "uuid": app.uuid,
                "slug": app.slug,
                "name": app.name,
                "installs": app.installations__count,
                "avatars": [serialize(avatar) for avatar in app.avatar.all()],
            }
            for app in sentry_apps
        ]

        return Response(apps)
