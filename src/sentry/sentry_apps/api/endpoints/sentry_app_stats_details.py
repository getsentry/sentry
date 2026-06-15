from typing import TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsMixin, control_silo_endpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import SentryAppParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.sentry_apps.api.bases.sentryapps import SentryAppBaseEndpoint, SentryAppStatsPermission
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation


class SentryAppStatsResponse(TypedDict):
    totalInstalls: int
    totalUninstalls: int
    # Each entry is a (timestamp, count) pair bucketed by the chosen resolution.
    installStats: list[tuple[int, int]]
    uninstallStats: list[tuple[int, int]]


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class SentryAppStatsEndpoint(SentryAppBaseEndpoint, StatsMixin):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SentryAppStatsPermission,)

    @extend_schema(
        operation_id="Retrieve a Sentry App's Install/Uninstall Stats",
        parameters=[
            SentryAppParams.SENTRY_APP_ID_OR_SLUG,
            OpenApiParameter(
                name="since",
                location="query",
                required=False,
                type=float,
                description="A UNIX timestamp that represents the start of the time series range, inclusive.",
            ),
            OpenApiParameter(
                name="until",
                location="query",
                required=False,
                type=float,
                description="A UNIX timestamp that represents the end of the time series range, inclusive.",
            ),
            OpenApiParameter(
                name="resolution",
                location="query",
                required=False,
                type=str,
                description="The resolution of the time series buckets, e.g. `1h`, `1d`. Defaults to an optimal resolution for the requested range.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer("SentryAppStats", SentryAppStatsResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, sentry_app) -> Response[SentryAppStatsResponse]:
        """
        Return the number of installations and uninstallations of a custom integration
        (Sentry App) over a time series range.
        """
        query_args = self._parse_args(request)

        installations = SentryAppInstallation.with_deleted.filter(
            sentry_app_id=sentry_app.id, date_added__range=(query_args["start"], query_args["end"])
        ).values_list("date_added", "date_deleted", "organization_id")
        install_count = SentryAppInstallation.with_deleted.filter(
            sentry_app_id=sentry_app.id
        ).count()
        uninstall_count = SentryAppInstallation.with_deleted.filter(
            sentry_app_id=sentry_app.id, date_deleted__isnull=False
        ).count()

        rollup, series = tsdb.backend.get_optimal_rollup_series(
            query_args["start"], query_args["end"]
        )

        install_stats = dict.fromkeys(series, 0)
        uninstall_stats = dict.fromkeys(series, 0)

        for date_added, date_deleted, organization_id in installations:
            install_norm_epoch = tsdb.backend.normalize_to_epoch(date_added, rollup)
            if install_norm_epoch in install_stats:
                install_stats[install_norm_epoch] += 1

            if date_deleted is not None:
                uninstall_norm_epoch = tsdb.backend.normalize_to_epoch(date_deleted, rollup)
                if uninstall_norm_epoch in uninstall_stats:
                    uninstall_stats[uninstall_norm_epoch] += 1

        result: SentryAppStatsResponse = {
            "totalInstalls": install_count,
            "totalUninstalls": uninstall_count,
            "installStats": sorted(install_stats.items(), key=lambda x: x[0]),
            "uninstallStats": sorted(uninstall_stats.items(), key=lambda x: x[0]),
        }

        return Response(result)
