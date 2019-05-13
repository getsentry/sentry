from __future__ import absolute_import

from django.db.models import Count
from rest_framework.response import Response

from sentry.api.bases import SentryAppsBaseEndpoint
from sentry.api.permissions import SuperuserPermission
from sentry.models import SentryApp


class SentryAppsStatsEndpoint(SentryAppsBaseEndpoint):
    permission_classes = (SuperuserPermission, )

    def get(self, request):
        sentry_apps = SentryApp.objects.filter(
            installations__date_deleted=None).annotate(
            Count('installations'))
        results = []
        for app in sentry_apps:
            results.append({
                'id': app.id,
                'slug': app.slug,
                'name': app.name,
                'installs': app.installations__count,
            })

        return Response(results)
