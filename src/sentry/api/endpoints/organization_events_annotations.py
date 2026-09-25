from typing import Any, NotRequired, TypedDict

import sentry_sdk
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.endpoints.timeseries import Annotation
from sentry.api.helpers.data_annotations import (
    DATASET_TO_CATEGORY,
    get_dropped_data_annotations,
)
from sentry.api.utils import handle_query_errors
from sentry.apidocs import constants as api_constants
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.snuba.utils import DATASET_LABELS


class AnnotationsMeta(TypedDict):
    dataset: str
    start: float
    end: float
    interval: float


class AnnotationsResponse(TypedDict):
    meta: AnnotationsMeta
    droppedAnnotations: list[Annotation]
    acceptedAnnotations: NotRequired[list[Annotation]]


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationEventsAnnotationsEndpoint(OrganizationEventsEndpointBase):
    """Serve data-fidelity annotations independently of any chart query.

    Unlike the inline ``meta.annotations`` on the events-timeseries endpoint,
    this endpoint:

    - runs no chart/aggregation query — it only reads Outcomes,
    - selects the *type* of dropped data via the ``dataset`` param (logs,
      spans, tracemetrics today; extensible through
      ``DATASET_TO_CATEGORY``), and
    - takes the bucket ``interval`` explicitly rather than inheriting a
      chart's resolved rollup.
    """

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    @extend_schema(
        operation_id="listOrganizationEventsAnnotations",
        summary="Query Data-Fidelity Annotations",
        parameters=[
            GlobalParams.END,
            GlobalParams.ENVIRONMENT,
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.START,
            GlobalParams.STATS_PERIOD,
            VisibilityParams.DATASET,
            VisibilityParams.INTERVAL,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsAnnotationsResponse", AnnotationsResponse
            ),
            400: OpenApiResponse(description="Invalid Query"),
            404: api_constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """Return dropped/accepted data-fidelity annotations for the selected
        dropped-data type over an explicit bucket interval."""
        dataset = self.get_dataset(request, organization)
        if DATASET_TO_CATEGORY.get(dataset) is None:
            supported = ", ".join(
                sorted(DATASET_LABELS[ds] for ds in DATASET_TO_CATEGORY if ds in DATASET_LABELS)
            )
            return Response(
                {"detail": f"dataset does not support annotations; must be one of: {supported}"},
                status=400,
            )

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(
                {
                    "meta": {
                        "dataset": DATASET_LABELS[dataset],
                        "start": 0,
                        "end": 0,
                        "interval": 0,
                    },
                    "droppedAnnotations": [],
                    "acceptedAnnotations": [],
                },
                status=200,
            )

        with handle_query_errors():
            # No aggregation query runs here, so pass top_events=0 and treat the
            # dataset as RPC-eligible for interval validation only.
            rollup = self.get_rollup(request, snuba_params, top_events=0, use_rpc=False)
            snuba_params.granularity_secs = rollup

            dropped_annotations: list[Annotation] = []
            accepted_annotations: list[Annotation] = []
            try:
                dropped_annotations, accepted_annotations = get_dropped_data_annotations(
                    dataset, snuba_params, rollup
                )
            except Exception:
                # Never break the caller on an Outcomes hiccup; mirror the inline
                # timeseries behavior of degrading to empty annotations.
                sentry_sdk.capture_exception()

        meta: AnnotationsMeta = {
            "dataset": DATASET_LABELS[dataset],
            "start": snuba_params.start_date.timestamp() * 1000,
            "end": snuba_params.end_date.timestamp() * 1000,
            "interval": rollup * 1000,
        }
        response: dict[str, Any] = {
            "meta": meta,
            "droppedAnnotations": dropped_annotations,
            "acceptedAnnotations": accepted_annotations,
        }
        return Response(response, status=200)
