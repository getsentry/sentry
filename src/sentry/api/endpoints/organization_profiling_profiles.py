from typing import Any

import sentry_sdk
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Limit, Op, Query, Storage
from snuba_sdk import Request as SnqlRequest

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.profiling_examples import ProfilingExamples
from sentry.apidocs.parameters import GlobalParams, OrganizationParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.profiles.flamegraph import FlamegraphExecutor
from sentry.profiles.profile_chunks import get_chunk_ids
from sentry.profiles.utils import proxy_profiling_service
from sentry.snuba.dataset import Dataset, StorageKey
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

FLAMEGRAPH_DATA_SOURCE_PARAM = OpenApiParameter(
    name="dataSource",
    location="query",
    required=False,
    type=str,
    enum=["transactions", "profiles", "functions", "spans"],
    description=(
        "Source dataset to build the flamegraph from. Defaults to `functions` when "
        "`fingerprint` is set and `transactions` otherwise."
    ),
)

FLAMEGRAPH_FINGERPRINT_PARAM = OpenApiParameter(
    name="fingerprint",
    location="query",
    required=False,
    type=int,
    description="A UInt32 function fingerprint. Only valid when `dataSource=functions`.",
)

FLAMEGRAPH_QUERY_PARAM = OpenApiParameter(
    name="query",
    location="query",
    required=False,
    type=str,
    description="Sentry [search syntax](https://docs.sentry.io/concepts/search/) to filter the candidate profiles.",
)

FLAMEGRAPH_EXPAND_PARAM = OpenApiParameter(
    name="expand",
    location="query",
    required=False,
    many=True,
    type=str,
    enum=["metrics"],
    description="Optional expansions. Pass `metrics` to include flamegraph metric aggregates in the response.",
)


class OrganizationProfilingBaseEndpoint(OrganizationEventsEndpointBase):
    owner = ApiOwner.PROFILING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }


class OrganizationProfilingFlamegraphSerializer(serializers.Serializer):
    # fingerprint is an UInt32
    fingerprint = serializers.IntegerField(min_value=0, max_value=(1 << 32) - 1, required=False)
    dataSource = serializers.ChoiceField(
        ["transactions", "profiles", "functions", "spans"], required=False
    )
    query = serializers.CharField(required=False)
    expand = serializers.ListField(child=serializers.ChoiceField(["metrics"]), required=False)

    def validate(self, attrs):
        source = attrs.get("dataSource")

        if source is None:
            if attrs.get("fingerprint") is not None:
                attrs["dataSource"] = "functions"
            else:
                attrs["dataSource"] = "transactions"
        elif source == "functions":
            attrs["dataSource"] = "functions"
        elif attrs.get("fingerprint") is not None:
            raise ParseError(
                detail='"fingerprint" is only permitted when using dataSource: "functions"'
            )
        elif source == "profiles":
            attrs["dataSource"] = "profiles"
        elif source == "spans":
            attrs["dataSource"] = "spans"
        else:
            attrs["dataSource"] = "transactions"

        return attrs


@extend_schema(tags=["Profiling"])
@cell_silo_endpoint
class OrganizationProfilingFlamegraphEndpoint(OrganizationProfilingBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="getOrganizationProfilingFlamegraph",
        summary="Retrieve a Flamegraph for an Organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            FLAMEGRAPH_DATA_SOURCE_PARAM,
            FLAMEGRAPH_FINGERPRINT_PARAM,
            FLAMEGRAPH_QUERY_PARAM,
            FLAMEGRAPH_EXPAND_PARAM,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationProfilingFlamegraphResponse", dict[str, Any]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProfilingExamples.FLAMEGRAPH,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[None] | Response[ValidationErrorResponse] | HttpResponse:
        """
        Retrieve an aggregated flamegraph for the organization, built from the
        requested data source (transactions, profiles, functions, or spans).

        Pass `expand=metrics` to include aggregated function metrics in the response.

        Requires profiling to be enabled for the organization.
        """
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        serializer = OrganizationProfilingFlamegraphSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)
        serialized = serializer.validated_data

        sentry_sdk.set_tag("query.dataSource", serialized["dataSource"])

        with handle_query_errors():
            executor = FlamegraphExecutor(
                request=request,
                snuba_params=snuba_params,
                data_source=serialized["dataSource"],
                query=serialized.get("query", ""),
                fingerprint=serialized.get("fingerprint"),
            )
            profile_candidates = executor.get_profile_candidates()

        expand = serialized.get("expand") or []
        if expand:
            if "metrics" in expand:
                profile_candidates["generate_metrics"] = True

        return proxy_profiling_service(
            method="POST",
            path=f"/organizations/{organization.id}/flamegraph",
            json_data=profile_candidates,
        )


PROFILER_ID_QUERY_PARAM = OpenApiParameter(
    name="profiler_id",
    location="query",
    required=True,
    type=str,
    description="The continuous-profiler ID to fetch chunks for.",
)

CHUNKS_PROJECT_PARAM = OpenApiParameter(
    name="project",
    location="query",
    required=True,
    type=int,
    description="The ID of the project to fetch chunks for. Exactly one project must be specified.",
)


@extend_schema(tags=["Profiling"])
@cell_silo_endpoint
class OrganizationProfilingChunksEndpoint(OrganizationProfilingBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="listOrganizationProfilingChunks",
        summary="Retrieve Profile Chunks for an Organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            CHUNKS_PROJECT_PARAM,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            PROFILER_ID_QUERY_PARAM,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationProfilingChunksResponse", dict[str, Any]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProfilingExamples.PROFILE_CHUNKS,
    )
    def get(self, request: Request, organization: Organization) -> Response[None] | HttpResponse:
        """
        Retrieve continuous profiling data for a profiler over a time range.

        Exactly one project must be specified via the `project` query parameter.

        Requires continuous profiling to be enabled for the organization.
        """
        if not features.has("organizations:continuous-profiling", organization, actor=request.user):
            return Response(status=404)

        # We disable the date quantizing here because we need the timestamps to be precise.
        snuba_params = self.get_snuba_params(request, organization, quantize_date_params=False)

        project_ids = snuba_params.project_ids
        if project_ids is None or len(project_ids) != 1:
            raise ParseError(detail="one project_id must be specified.")

        profiler_id = request.query_params.get("profiler_id")
        if profiler_id is None:
            raise ParseError(detail="profiler_id must be specified.")

        chunk_ids = get_chunk_ids(snuba_params, profiler_id, project_ids[0])

        return proxy_profiling_service(
            method="POST",
            path=f"/organizations/{organization.id}/projects/{project_ids[0]}/chunks",
            json_data={
                "profiler_id": profiler_id,
                "chunk_ids": chunk_ids,
                "start": str(int(snuba_params.start_date.timestamp() * 1e9)),
                "end": str(int(snuba_params.end_date.timestamp() * 1e9)),
            },
        )


@cell_silo_endpoint
class OrganizationProfilingHasChunksEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> HttpResponse:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        snuba_params = self.get_snuba_params(request, organization)

        with handle_query_errors():
            # We just need to query to see if any chunks exists in that time range.
            query = Query(
                match=Storage(StorageKey.ProfileChunks.value),
                select=[Column("project_id")],
                where=[
                    Condition(Column("project_id"), Op.IN, snuba_params.project_ids),
                    Condition(Column("end_timestamp"), Op.GTE, snuba_params.start),
                    Condition(Column("start_timestamp"), Op.LT, snuba_params.end),
                ],
                limit=Limit(1),
            )

            referrer = Referrer.API_PROFILING_PROFILE_HAS_CHUNKS.value

            request = SnqlRequest(
                dataset=Dataset.Profiles.value,
                app_id="default",
                query=query,
                tenant_ids={
                    "referrer": referrer,
                    "organization_id": organization.id,
                },
            )

            data = raw_snql_query(request, referrer)["data"]

        return Response({"hasChunks": len(data) > 0}, status=200)
