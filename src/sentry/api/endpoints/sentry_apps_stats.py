from __future__ import absolute_import

from rest_framework.response import Response

from django.db.models import Count
from sentry.api.bases import SentryAppsBaseEndpoint
from sentry.models import SentryApp
from sentry.api.permissions import SuperuserPermission


class SentryAppsStatsEndpoint(SentryAppsBaseEndpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        sentry_apps = SentryApp.objects.filter(installations__date_deleted=None).annotate(
            Count("installations")
        )
        results = []
        for app in sentry_apps:
            results.append(
                {
                    "id": app.id,
                    "slug": app.slug,
                    "name": app.name,
                    "installs": app.installations__count,
                }
            )

        return Response(results)
