from uuid import uuid4

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.parameters import GlobalParams, ProjectParams
from sentry.lang.native.sources import (
    REDACTED_SOURCE_SCHEMA,
    REDACTED_SOURCES_SCHEMA,
    InvalidSourcesError,
    backfill_source,
    parse_sources,
    redact_source_secrets,
    validate_sources,
)
from sentry.models import Project
from sentry.utils import json


@extend_schema(tags=["Projects"])
@region_silo_endpoint
class ProjectSymbolSourcesEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_NATIVE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "DELETE": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve a Project's Symbol Sources",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ProjectParams.source_id("The ID of the source to look up.", False),
        ],
        responses={
            # TODO
            200: REDACTED_SOURCES_SCHEMA,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.SYMBOL_SOURCES,
    )
    def get(self, request: Request, project: Project) -> Response:
        """
        List custom symbol sources configured for a project.
        """
        id = request.GET.get("id")
        custom_symbol_sources_json = project.get_option("sentry:symbol_sources") or []
        sources = parse_sources(custom_symbol_sources_json, False)
        redacted = redact_source_secrets(sources)

        if id:
            for source in redacted:
                if source["id"] == id:
                    return Response([source])
            return Response(data={"error": f"Unknown source id: {id}"}, status=404)

        return Response(redacted)

    @extend_schema(
        operation_id="Delete a Symbol Source from a Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ProjectParams.source_id("The ID of the source to delete.", True),
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, project: Project) -> Response:
        """
        Delete a custom symbol source from a project.
        """
        id = request.GET.get("id")
        custom_symbol_sources_json = project.get_option("sentry:symbol_sources") or []

        sources = parse_sources(custom_symbol_sources_json, False)

        if id:
            filtered_sources = [src for src in sources if src["id"] != id]
            if len(filtered_sources) == len(sources):
                return Response(data={"error": f"Unknown source id: {id}"}, status=404)

            serialized = json.dumps(filtered_sources)
            project.update_option("sentry:symbol_sources", serialized)
            return Response(status=204)

        return Response(data={"error": "Missing source id"}, status=404)

    @extend_schema(
        operation_id="Add a Symbol Source to a Project",
        parameters=[GlobalParams.ORG_SLUG, GlobalParams.PROJECT_SLUG],
        request=None,
        responses={
            201: REDACTED_SOURCE_SCHEMA,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
    )
    def post(self, request: Request, project: Project) -> Response:
        """
        Add a custom symbol source to a project.
        """
        custom_symbol_sources_json = project.get_option("sentry:symbol_sources") or []
        sources = parse_sources(custom_symbol_sources_json, False)

        source = request.data

        if "id" in source:
            id = source["id"]
        else:
            id = str(uuid4())
            source["id"] = id

        sources.append(source)

        try:
            validate_sources(sources)
        except InvalidSourcesError:
            return Response(status=400)

        serialized = json.dumps(sources)
        project.update_option("sentry:symbol_sources", serialized)

        redacted = redact_source_secrets([source])
        return Response(data=redacted[0], status=201)

    @extend_schema(
        operation_id="Update a Symbol Source in a Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ProjectParams.source_id("The ID of the source to update.", True),
        ],
        request=None,
        responses={
            200: REDACTED_SOURCE_SCHEMA,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: Request, project: Project) -> Response:
        """
        Update a custom symbol source in a project.
        """
        id = request.GET.get("id")
        source = request.data

        custom_symbol_sources_json = project.get_option("sentry:symbol_sources") or []
        sources = parse_sources(custom_symbol_sources_json, False)

        if id is None:
            return Response(data={"error": "Missing source id"}, status=404)

        if "id" not in source:
            source["id"] = str(uuid4())

        try:
            sources_by_id = {src["id"]: src for src in sources}
            backfill_source(source, sources_by_id)
        except InvalidSourcesError:
            return Response(status=400)
        except KeyError:
            return Response(status=400)

        found = False
        for i in range(len(sources)):
            if sources[i]["id"] == id:
                found = True
                sources[i] = source

        if not found:
            return Response(data={"error": f"Unknown source id: {id}"}, status=404)

        try:
            validate_sources(sources)
        except InvalidSourcesError as e:
            return Response(data={"error": str(e)}, status=400)

        serialized = json.dumps(sources)
        project.update_option("sentry:symbol_sources", serialized)

        redacted = redact_source_secrets([source])
        return Response(data=redacted[0], status=200)
