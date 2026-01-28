from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsMixin, control_silo_endpoint
from sentry.sentry_apps.api.bases.sentryapps import SentryAppBaseEndpoint, SentryAppStatsPermission
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation


@control_silo_endpoint
class SentryAppStatsEndpoint(SentryAppBaseEndpoint, StatsMixin):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (SentryAppStatsPermission,)

    def get(self, request: Request, sentry_app) -> Response:
        """
        :qparam float since
        :qparam float until
        :qparam resolution - optional
        """

        query_args = self._parse_args(request)

        installations = SentryAppInstallation.with_deleted.filter(
            sentry_app_id=sentry_app.id, date_added__range=(query_args["start"], query_args["end"])
        ).values_list("date_added", "organization_id")
        install_count = SentryAppInstallation.with_deleted.filter(
            sentry_app_id=sentry_app.id
        ).count()

        rollup, series = tsdb.backend.get_optimal_rollup_series(
            query_args["start"], query_args["end"]
        )

        install_stats = dict.fromkeys(series, 0)

        for date_added, organization_id in installations:
            install_norm_epoch = tsdb.backend.normalize_to_epoch(date_added, rollup)
            if install_norm_epoch in install_stats:
                install_stats[install_norm_epoch] += 1

        result = {
            "totalInstalls": install_count,
            "installStats": sorted(install_stats.items(), key=lambda x: x[0]),
        }

        return Response(result)
