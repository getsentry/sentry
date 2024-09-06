import sentry_sdk
from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.profiles.flamegraph import (
    FlamegraphExecutor,
    get_chunks_from_spans_metadata,
    get_profile_ids,
    get_profiles_with_function,
    get_spans_from_group,
)
from sentry.profiles.profile_chunks import get_chunk_ids
from sentry.profiles.utils import proxy_profiling_service


class OrganizationProfilingBaseEndpoint(OrganizationEventsV2EndpointBase):
    owner = ApiOwner.PROFILING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }


class OrganizationProfilingFlamegraphSerializer(serializers.Serializer):
    # fingerprint is an UInt32
    fingerprint = serializers.IntegerField(min_value=0, max_value=(1 << 32) - 1, required=False)
    dataSource = serializers.ChoiceField(["transactions", "profiles", "functions"], required=False)
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
        else:
            attrs["dataSource"] = "transactions"

        return attrs


@region_silo_endpoint
class OrganizationProfilingFlamegraphEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> HttpResponse:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        if not features.has(
            "organizations:continuous-profiling-compat", organization, actor=request.user
        ):
            snuba_params = self.get_snuba_params(request, organization)

            project_ids = snuba_params.project_ids
            if len(project_ids) > 1:
                raise ParseError(detail="You cannot get a flamegraph from multiple projects.")

            if request.query_params.get("fingerprint"):
                sentry_sdk.set_tag("data source", "functions")
                function_fingerprint = int(request.query_params["fingerprint"])

                profile_ids = get_profiles_with_function(
                    organization.id,
                    project_ids[0],
                    function_fingerprint,
                    snuba_params,
                    request.GET.get("query", ""),
                )
            else:
                sentry_sdk.set_tag("data source", "profiles")
                profile_ids = get_profile_ids(snuba_params, request.query_params.get("query", None))

            return proxy_profiling_service(
                method="POST",
                path=f"/organizations/{organization.id}/projects/{project_ids[0]}/flamegraph",
                json_data=profile_ids,
            )

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        serializer = OrganizationProfilingFlamegraphSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        with handle_query_errors():
            executor = FlamegraphExecutor(
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


@region_silo_endpoint
class OrganizationProfilingChunksEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> HttpResponse:
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


@region_silo_endpoint
class OrganizationProfilingChunksFlamegraphEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> HttpResponse:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        snuba_params = self.get_snuba_params(request, organization)

        project_ids = snuba_params.project_ids
        if len(project_ids) != 1:
            raise ParseError(detail="one project_id must be specified.")

        span_group = request.query_params.get("span_group")
        if span_group is None:
            raise ParseError(detail="span_group must be specified.")

        spans = get_spans_from_group(
            organization.id,
            project_ids[0],
            snuba_params,
            span_group,
        )

        chunksMetadata = get_chunks_from_spans_metadata(organization.id, project_ids[0], spans)

        return proxy_profiling_service(
            method="POST",
            path=f"/organizations/{organization.id}/projects/{project_ids[0]}/chunks-flamegraph",
            json_data={"chunks_metadata": chunksMetadata},
        )
