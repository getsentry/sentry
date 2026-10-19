from collections.abc import Sequence
from typing import Any, TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_events import EventsMeta
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors, reformat_timestamp_ms_to_isoformat
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import (
    CursorQueryParam,
    GlobalParams,
    OrganizationParams,
    VisibilityParams,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.replays.permissions import has_replay_permission

ReplayEventsMetaEvent = TypedDict(
    "ReplayEventsMetaEvent",
    {
        "error.type": list[str] | str,
        "id": str,
        "issue.id": int,
        "issue": str,
        "level": str,
        "project.name": str,
        "timestamp": str,
        "title": str,
    },
)


class ReplayEventsMetaResponse(TypedDict):
    data: list[ReplayEventsMetaEvent]
    meta: EventsMeta


class ReplayEventsMetaNoProjectsResponse(TypedDict):
    count: int


REPLAY_EVENTS_META_DATASET = OpenApiParameter(
    name="dataset",
    location="query",
    required=False,
    type=str,
    description="""The dataset to query. Defaults to `discover`. Use `errors` for errors only, or `issuePlatform` for other issue types, such as rage clicks.""",
)


@extend_schema(tags=["Replays"])
@cell_silo_endpoint
class OrganizationReplayEventsMetaEndpoint(OrganizationEventsEndpointBase):
    """The generic Events endpoints require that the cross-project selection feature
    be enabled before they return across multiple projects.


    This endpoint is purpose built for the Session Replay product which intentionally
    requests data across multiple transactions, and therefore potentially multiple projects.
    This is similar to performance, and modeled after `OrganizationEventsMetaEndpoint`.

    This endpoint offers a narrow interface specific to the requirements of `useReplayData.tsx`
    """

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get_field_list(
        self, organization: Organization, request: Request, param_name: str = "field"
    ) -> list[str]:
        fields = [
            "error.type",
            "id",
            "issue.id",
            "issue",
            "timestamp",
            "title",
            "level",
            "timestamp_ms",
        ]

        return fields

    @extend_schema(
        operation_id="listOrganizationReplayEvents",
        summary="List an Organization's Replay Events",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.START,
            GlobalParams.END,
            GlobalParams.STATS_PERIOD,
            GlobalParams.ENVIRONMENT,
            OrganizationParams.PROJECT,
            VisibilityParams.QUERY,
            VisibilityParams.SORT,
            VisibilityParams.PER_PAGE,
            REPLAY_EVENTS_META_DATASET,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ReplayEventsMetaResponse",
                ReplayEventsMetaResponse | ReplayEventsMetaNoProjectsResponse,
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Return the error and issue events associated with a replay, across all projects the
        user has access to. Each event includes a fixed set of fields: `error.type`, `id`,
        `issue.id`, `issue`, `level`, `project.name`, `timestamp`, and `title`. Filter to a
        replay's events with the `query` parameter, e.g. `replayId:<replay_id>`.

        If the user has no accessible projects, `{"count": 0}` is returned instead.
        """
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)

        if not has_replay_permission(request, organization):
            return Response(status=403)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"count": 0})

        dataset = self.get_dataset(request, organization)

        def data_fn(offset, limit):
            query_details = {
                "selected_columns": self.get_field_list(organization, request),
                "query": request.GET.get("query"),
                "snuba_params": snuba_params,
                "equations": self.get_equation_list(organization, request),
                "orderby": self.get_orderby(request),
                "offset": offset,
                "limit": limit,
                "referrer": "api.replay.details-page",
                "auto_fields": True,
                "auto_aggregations": True,
                "use_aggregate_conditions": True,
                "allow_metric_aggregates": False,
                "transform_alias_to_input_format": True,
            }

            return dataset.query(**query_details)

        with handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=lambda results: self.handle_results_with_meta(
                    request,
                    organization,
                    snuba_params.project_ids,
                    results,
                    standard_meta=True,
                ),
            )

    def handle_results_with_meta(
        self,
        request: Request,
        organization: Organization,
        project_ids: Sequence[int],
        results: dict[str, Any],
        standard_meta: bool | None = False,
        dataset: Any | None = None,
    ) -> dict[str, Any]:
        results = super().handle_results_with_meta(
            request, organization, project_ids, results, standard_meta, dataset
        )
        for event in results["data"]:
            if "timestamp_ms" in event and event["timestamp_ms"]:
                event["timestamp"] = reformat_timestamp_ms_to_isoformat(event["timestamp_ms"])

            if "timestamp_ms" in event:
                del event["timestamp_ms"]
        return results
