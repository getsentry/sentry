from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsMixin, cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environment_id
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.ingest.inbound_filters import FILTER_STAT_KEYS_TO_VALUES
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.tsdb.base import TSDBModel
from sentry.types.ratelimit import RateLimit, RateLimitCategory

PROJECT_STATS_EXAMPLE = [
    [1541455200, 1184],
    [1541458800, 1410],
    [1541462400, 1440],
    [1541466000, 1682],
    [1541469600, 1203],
    [1541473200, 497],
    [1541476800, 661],
    [1541480400, 1481],
    [1541484000, 678],
    [1541487600, 1857],
    [1541491200, 819],
    [1541494800, 1013],
    [1541498400, 1883],
    [1541502000, 1450],
    [1541505600, 1102],
    [1541509200, 1317],
    [1541512800, 1017],
    [1541516400, 813],
    [1541520000, 1189],
    [1541523600, 496],
    [1541527200, 1936],
    [1541530800, 1405],
    [1541534400, 617],
    [1541538000, 1533],
]


@extend_schema(tags=["Projects"])
@cell_silo_endpoint
class ProjectStatsEndpoint(ProjectEndpoint, StatsMixin):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=5, window=1),
                RateLimitCategory.USER: RateLimit(limit=5, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=1),
            }
        },
    )

    @extend_schema(
        operation_id="Retrieve Event Counts for a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            OpenApiParameter(
                name="stat",
                location="query",
                required=False,
                type=str,
                enum=["received", "rejected", "blacklisted", "generated"],
                description="The name of the stat to query. Defaults to `received`.",
            ),
            OpenApiParameter(
                name="since",
                location="query",
                required=False,
                type=float,
                description="A UNIX timestamp (in seconds) that sets the start of the query range.",
            ),
            OpenApiParameter(
                name="until",
                location="query",
                required=False,
                type=float,
                description="A UNIX timestamp (in seconds) that sets the end of the query range.",
            ),
            OpenApiParameter(
                name="resolution",
                location="query",
                required=False,
                type=str,
                enum=["10s", "1h", "1d"],
                description="An explicit time series resolution.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer("ProjectStats", list[tuple[int, int]]),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                "Project event counts",
                value=PROJECT_STATS_EXAMPLE,
                response_only=True,
                status_codes=["200"],
            )
        ],
    )
    def get(self, request: Request, project: Project) -> Response[list[tuple[int, int]]]:
        """
        Return a set of points representing a normalized timestamp and the number of
        events seen in the period.

        Query ranges are limited to Sentry's configured time-series resolutions.
        This endpoint may change in the future without notice.
        """
        stat = request.GET.get("stat", "received")
        query_kwargs = {}
        if stat == "received":
            stat_model = TSDBModel.project_total_received
        elif stat == "rejected":
            stat_model = TSDBModel.project_total_rejected
        elif stat == "blacklisted":
            stat_model = TSDBModel.project_total_blacklisted
        elif stat == "generated":
            stat_model = TSDBModel.project
            try:
                query_kwargs["environment_id"] = get_environment_id(
                    request, project.organization_id
                )
            except Environment.DoesNotExist:
                raise ResourceDoesNotExist
        else:
            try:
                stat_model = FILTER_STAT_KEYS_TO_VALUES[stat]
            except KeyError:
                raise ValidationError("Invalid stat: %s" % stat)

        data = tsdb.backend.get_range(
            model=stat_model,
            keys=[project.id],
            **self._parse_args(request, **query_kwargs),
            tenant_ids={"organization_id": project.organization_id},
        )[project.id]

        return Response(data)
