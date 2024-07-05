from typing import Any

import sentry_sdk
from django.http import HttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint

# from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.profiles.flamegraph import (
    get_chunks_from_spans_metadata,
    get_profile_ids,
    get_profile_ids_with_spans,
    get_profiles_with_function,
    get_spans_from_group,
)
from sentry.profiles.profile_chunks import get_chunk_ids
from sentry.profiles.utils import parse_profile_filters, proxy_profiling_service


class OrganizationProfilingBaseEndpoint(OrganizationEventsV2EndpointBase):
    owner = ApiOwner.PROFILING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get_profiling_params(self, request: Request, organization: Organization) -> dict[str, Any]:
        try:
            params: dict[str, Any] = parse_profile_filters(request.query_params.get("query", ""))
        except InvalidSearchQuery as err:
            raise ParseError(detail=str(err))

        params.update(self.get_filter_params(request, organization))

        return params


@region_silo_endpoint
class OrganizationProfilingFiltersEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> HttpResponse:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_profiling_params(request, organization)
        except NoProjects:
            return Response([])

        return proxy_profiling_service(
            "GET", f"/organizations/{organization.id}/filters", params=params
        )


@region_silo_endpoint
class OrganizationProfilingFlamegraphEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> HttpResponse:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        params = self.get_snuba_params(request, organization)
        project_ids = params["project_id"]
        if len(project_ids) > 1:
            raise ParseError(detail="You cannot get a flamegraph from multiple projects.")

        span_group = request.query_params.get("spans.group", None)
        if span_group is not None:
            sentry_sdk.set_tag("dataset", "spans")
            profile_ids: object = get_profile_ids_with_spans(
                organization.id,
                project_ids[0],
                params,
                span_group,
            )
        elif request.query_params.get("fingerprint"):
            sentry_sdk.set_tag("dataset", "functions")
            function_fingerprint = int(request.query_params["fingerprint"])
            profile_ids = get_profiles_with_function(
                organization.id,
                project_ids[0],
                function_fingerprint,
                params,
                request.GET.get("query", ""),
            )
        else:
            sentry_sdk.set_tag("dataset", "profiles")
            profile_ids = get_profile_ids(params, request.query_params.get("query", None))

        return proxy_profiling_service(
            method="POST",
            path=f"/organizations/{organization.id}/projects/{project_ids[0]}/flamegraph",
            json_data=profile_ids,
        )


@region_silo_endpoint
class OrganizationProfilingChunksEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> HttpResponse:
        if not features.has("organizations:continuous-profiling", organization, actor=request.user):
            return Response(status=404)

        params = self.get_snuba_params(request, organization)

        project_ids = params.get("project_id")
        if project_ids is None or len(project_ids) != 1:
            raise ParseError(detail="one project_id must be specified.")

        profiler_id = request.query_params.get("profiler_id")
        if profiler_id is None:
            raise ParseError(detail="profiler_id must be specified.")

        chunk_ids = get_chunk_ids(params, profiler_id, project_ids[0])
        return proxy_profiling_service(
            method="POST",
            path=f"/organizations/{organization.id}/projects/{project_ids[0]}/chunks",
            json_data={
                "profiler_id": profiler_id,
                "chunk_ids": [el["chunk_id"] for el in chunk_ids],
            },
        )


@region_silo_endpoint
class OrganizationProfilingChunksFlamegraphEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> HttpResponse:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        params = self.get_snuba_params(request, organization)

        project_ids = params.get("project_id")
        if project_ids is None or len(project_ids) != 1:
            raise ParseError(detail="one project_id must be specified.")

        span_group = request.query_params.get("span_group")
        if span_group is None:
            raise ParseError(detail="span_group must be specified.")

        spans = get_spans_from_group(
            organization.id,
            project_ids[0],
            params,
            span_group,
        )

        chunksMetadata = get_chunks_from_spans_metadata(organization.id, project_ids[0], spans)

        return proxy_profiling_service(
            method="POST",
            path=f"/organizations/{organization.id}/projects/{project_ids[0]}/chunks-flamegraph",
            json_data={"chunks_metadata": chunksMetadata},
        )
