from typing import Any, TypedDict

import sentry_sdk
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.client_kind import get_client_kind
from sentry.api.endpoints.timeseries import Annotation
from sentry.api.helpers.data_annotations import (
    DATASET_TO_CATEGORY,
    get_dropped_data_annotations,
    record_dropped_events_telemetry,
)
from sentry.api.utils import handle_query_errors
from sentry.apidocs import constants as api_constants
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.snuba.utils import DATASET_LABELS
from sentry.utils.tracing import start_span

_ENDPOINT = "events-dropped"

_ACCEPTED = "accepted"


class DroppedEventsBucket(TypedDict):
    type: str
    category: str
    outcome: str
    reason: str
    start: float
    end: float
    count: float


class DroppedEventsMeta(TypedDict):
    dataset: str
    start: float
    end: float
    interval: float


class DroppedEventsResponse(TypedDict):
    meta: DroppedEventsMeta
    droppedEvents: list[DroppedEventsBucket]
    acceptedEvents: list[DroppedEventsBucket]


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationEventsDroppedEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    @extend_schema(
        operation_id="listOrganizationEventsDropped",
        summary="Query Dropped Events",
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
                "OrganizationEventsDroppedResponse", DroppedEventsResponse
            ),
            400: OpenApiResponse(description="Invalid Query"),
            404: api_constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """Return the events Sentry received but dropped (rate limited, filtered,
        invalid, abuse, client discarded, cardinality limited) bucketed over the
        requested interval, alongside the accepted volume per bucket so a caller
        can compute the dropped share.

        Select the dropped-data type with ``dataset`` and the bucket size with
        ``interval``.
        """
        dataset = self.get_dataset(request, organization)
        if DATASET_TO_CATEGORY.get(dataset) is None:
            supported = ", ".join(
                sorted(DATASET_LABELS[ds] for ds in DATASET_TO_CATEGORY if ds in DATASET_LABELS)
            )
            return Response(
                {"detail": f"dataset does not support dropped events; must be one of: {supported}"},
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
                    "droppedEvents": [],
                    "acceptedEvents": [],
                },
                status=200,
            )

        with handle_query_errors():
            # top_events=0 / use_rpc=False: no aggregation query runs here, so this
            # only exercises get_rollup's interval validation.
            rollup = self.get_rollup(request, snuba_params, top_events=0, use_rpc=False)
            snuba_params.granularity_secs = rollup

            dropped_events: list[DroppedEventsBucket] = []
            accepted_events: list[DroppedEventsBucket] = []
            with start_span(op="dropped_events.serve", name=_ENDPOINT):
                try:
                    dropped_raw, accepted_raw = get_dropped_data_annotations(
                        dataset, snuba_params, rollup
                    )
                    dropped_events = [_to_bucket(bucket) for bucket in dropped_raw]
                    accepted_events = [
                        _to_bucket(bucket, outcome=_ACCEPTED, reason=_ACCEPTED)
                        for bucket in accepted_raw
                    ]
                except Exception:
                    # An Outcomes failure degrades to empty rather than failing the request.
                    sentry_sdk.capture_exception()

            record_dropped_events_telemetry(
                endpoint=_ENDPOINT,
                client_kind=get_client_kind(request).value,
                dataset_label=DATASET_LABELS[dataset],
                dropped_count=len(dropped_events),
                accepted_count=len(accepted_events),
            )

        meta: DroppedEventsMeta = {
            "dataset": DATASET_LABELS[dataset],
            "start": snuba_params.start_date.timestamp() * 1000,
            "end": snuba_params.end_date.timestamp() * 1000,
            "interval": rollup * 1000,
        }
        response: dict[str, Any] = {
            "meta": meta,
            "droppedEvents": dropped_events,
            "acceptedEvents": accepted_events,
        }
        return Response(response, status=200)


def _to_bucket(
    raw: Annotation, *, outcome: str | None = None, reason: str | None = None
) -> DroppedEventsBucket:
    return {
        "type": raw["type"],
        "category": raw["category"],
        "outcome": outcome if outcome is not None else raw["outcome"],
        "reason": reason if reason is not None else raw["reason"],
        "start": raw["start"],
        "end": raw["end"],
        "count": raw["eventCount"],
    }
