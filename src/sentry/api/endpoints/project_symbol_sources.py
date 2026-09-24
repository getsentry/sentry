from collections.abc import Mapping, Sequence
from dataclasses import replace
from typing import Any, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
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
    SOURCE_KINDS,
    Field,
    InvalidSourcesError,
    ProjectSymbolSources,
    Source,
    SourceKind,
    UnknownSourceId,
    choice,
    object_schema,
)
from sentry.models.project import Project


def _only_for(field: Field, kinds: Sequence[SourceKind]) -> Field:
    names = " and ".join(f"`{kind.type}`" for kind in kinds)
    word = "Required" if field.required else "Optional"
    note = f"{word} for {names} sources, invalid for all others."
    return replace(field, description=f"{field.description} {note}", required=False)


def _request_schema(kinds: Sequence[SourceKind]) -> dict[str, Any]:
    """
    One object that documents the request body for every kind.

    The API docs render a request body as one flat object, so the kinds are
    merged. A field that only some kinds use says so in its description.
    Validation still uses the per-kind schemas.
    """
    fields = {
        "type": choice("The type of the source.", {k.type: k.label for k in kinds}, required=True)
    }
    for kind in kinds:
        for name, field in kind.request_fields.items():
            assert fields.setdefault(name, field) == field, f"kinds disagree on {name}"
    for name, field in fields.items():
        owners = [kind for kind in kinds if name in kind.fields]
        if 0 < len(owners) < len(kinds):
            fields[name] = _only_for(field, owners)
    return object_schema(fields)


SOURCE_REQUEST = {"application/json": _request_schema(list(SOURCE_KINDS.values()))}


class SymbolSourceErrorResponse(TypedDict):
    """`{"error": "..."}` envelope used by symbol-source endpoints in place of
    the DRF-standard `{"detail": ...}`. Retained for backward compatibility
    with existing API consumers."""

    error: str


@extend_schema(tags=["Projects"])
@cell_silo_endpoint
class ProjectSymbolSourcesEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "DELETE": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    def handle_exception_with_details(
        self,
        request: Request,
        exc: Exception,
        handler_context: Mapping[str, Any] | None = None,
        scope: Scope | None = None,
    ) -> Response:
        if isinstance(exc, UnknownSourceId):
            return Response({"error": str(exc)}, status=404)
        if isinstance(exc, InvalidSourcesError):
            return Response({"error": str(exc)}, status=400)
        return super().handle_exception_with_details(request, exc, handler_context, scope)

    @extend_schema(
        operation_id="listProjectSymbolSources",
        summary="Retrieve a Project's Symbol Sources",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ProjectParams.source_id(
                "The ID of the source to look up. If this is not provided, all sources are returned.",
                False,
            ),
        ],
        responses={
            200: REDACTED_SOURCES_SCHEMA,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.GET_SYMBOL_SOURCES,
    )
    def get(
        self, request: Request, project: Project
    ) -> Response[list[Source]] | Response[SymbolSourceErrorResponse]:
        """
        List custom symbol sources configured for a project.
        """
        sources = ProjectSymbolSources.load(project)
        source_id = request.GET.get("id")
        if source_id:
            return Response([sources.get(source_id)])
        return Response(sources.all())

    @extend_schema(
        operation_id="deleteProjectSymbolSource",
        summary="Delete a Symbol Source from a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ProjectParams.source_id("The ID of the source to delete.", True),
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.DELETE_SYMBOL_SOURCE,
    )
    def delete(
        self, request: Request, project: Project
    ) -> Response[None] | Response[SymbolSourceErrorResponse]:
        """
        Delete a custom symbol source from a project.
        """
        ProjectSymbolSources.load(project).remove(request.GET.get("id"))
        return Response(status=204)

    @extend_schema(
        operation_id="addProjectSymbolSource",
        summary="Add a Symbol Source to a Project",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=SOURCE_REQUEST,
        responses={
            201: REDACTED_SOURCE_SCHEMA,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=ProjectExamples.ADD_SYMBOL_SOURCE,
    )
    def post(
        self, request: Request, project: Project
    ) -> Response[Source] | Response[SymbolSourceErrorResponse]:
        """
        Add a custom symbol source to a project.
        """
        source = ProjectSymbolSources.load(project).add(request.data)
        return Response(source, status=201)

    @extend_schema(
        operation_id="updateProjectSymbolSource",
        summary="Update a Project's Symbol Source",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ProjectParams.source_id("The ID of the source to update.", True),
        ],
        request=SOURCE_REQUEST,
        responses={
            200: REDACTED_SOURCE_SCHEMA,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.UPDATE_SYMBOL_SOURCE,
    )
    def put(
        self, request: Request, project: Project
    ) -> Response[Source] | Response[SymbolSourceErrorResponse]:
        """
        Update a custom symbol source in a project.
        """
        source = ProjectSymbolSources.load(project).replace(request.GET.get("id"), request.data)
        return Response(source)
