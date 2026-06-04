from drf_spectacular.utils import OpenApiParameter, extend_schema
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
from sentry.ratelimits.config import RateLimitConfig
from sentry.tsdb.base import TSDBModel
from sentry.types.ratelimit import RateLimit, RateLimitCategory


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
    )
    def get(self, request: Request, project) -> Response:
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
