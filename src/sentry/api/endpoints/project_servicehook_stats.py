from typing import TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsMixin, cell_silo_endpoint
from sentry.api.bases.servicehook import ServiceHookEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.tsdb.base import TSDBModel


class ServiceHookStatsResponse(TypedDict):
    ts: int
    total: int


@extend_schema(tags=["Integration"])
@cell_silo_endpoint
class ProjectServiceHookStatsEndpoint(ServiceHookEndpoint, StatsMixin):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="Retrieve a Service Hook's Stats",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            OpenApiParameter(
                name="hook_id",
                location="path",
                required=True,
                type=str,
                description="The GUID of the service hook.",
            ),
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
                description="The time series resolution, e.g. `1h`, `1d`.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListServiceHookStats", list[ServiceHookStatsResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, project: Project, hook: ServiceHook, **kwargs
    ) -> Response[list[ServiceHookStatsResponse]]:
        """
        Return the number of times a service hook has fired over a time series range.
        """
        stat_args = self._parse_args(request)

        stats: dict[int, dict[str, int]] = {}
        for model, name in ((TSDBModel.servicehook_fired, "total"),):
            result = tsdb.backend.get_range(
                model=model,
                keys=[hook.id],
                **stat_args,
                tenant_ids={"organization_id": project.organization_id},
            )[hook.id]
            for ts, count in result:
                stats.setdefault(int(ts), {})[name] = count

        return self.respond([{"ts": ts, "total": data["total"]} for ts, data in stats.items()])
