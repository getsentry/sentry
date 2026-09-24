from collections.abc import Mapping
from copy import deepcopy
from typing import Any

from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema
from rest_framework import serializers
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
from sentry.lang.native.project_symbol_sources import (
    InvalidSourcesError,
    ProjectSymbolSources,
    Source,
    UnknownSourceId,
)
from sentry.lang.native.source_kinds import SOURCE_SERIALIZERS, SourceType
from sentry.models.project import Project


class SourceSerializer(serializers.Serializer):
    """
    The request body for adding or updating a source.

    The API docs render a request body as one flat object, so this merges the
    documented fields of every kind. A field that only some kinds use says so
    in its help text. Validation uses the serializer of the kind itself.
    """

    def get_fields(self) -> dict[str, serializers.Field]:
        kind_fields = {kind: cls().fields for kind, cls in SOURCE_SERIALIZERS.items()}
        fields: dict[str, serializers.Field] = {
            "type": serializers.ChoiceField(
                choices=list(SourceType), help_text="The type of the source."
            )
        }
        for owner_fields in kind_fields.values():
            for name, field in owner_fields.items():
                if name != "type" and field.help_text:
                    fields.setdefault(name, deepcopy(field))
        for name, field in fields.items():
            owners = [kind for kind, owner_fields in kind_fields.items() if name in owner_fields]
            if 0 < len(owners) < len(kind_fields):
                names = " and ".join(f"`{kind}`" for kind in owners)
                word = "Required" if field.required else "Optional"
                field.help_text = (
                    f"{field.help_text} {word} for {names} sources, invalid for all others."
                )
                field.required = False
        return fields


SOURCE_RESPONSE = PolymorphicProxySerializer(
    component_name="SymbolSource",
    serializers=list(SOURCE_SERIALIZERS.values()),
    resource_type_field_name="type",
)
SOURCES_RESPONSE = PolymorphicProxySerializer(
    component_name="SymbolSource",
    serializers=list(SOURCE_SERIALIZERS.values()),
    resource_type_field_name="type",
    many=True,
)


def _source_id(request: Request) -> str:
    source_id = request.GET.get("id")
    if not source_id:
        raise InvalidSourcesError("Missing source id")
    return source_id


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
        # The `error` envelope predates this endpoint's rewrite and is kept for
        # existing API consumers.
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
            200: SOURCES_RESPONSE,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.GET_SYMBOL_SOURCES,
    )
    def get(self, request: Request, project: Project) -> Response[list[Source]]:
        """
        List custom symbol sources configured for a project.
        """
        sources = ProjectSymbolSources(project)
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
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.DELETE_SYMBOL_SOURCE,
    )
    def delete(self, request: Request, project: Project) -> Response[None]:
        """
        Delete a custom symbol source from a project.
        """
        ProjectSymbolSources(project).remove(_source_id(request))
        return Response(status=204)

    @extend_schema(
        operation_id="addProjectSymbolSource",
        summary="Add a Symbol Source to a Project",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=SourceSerializer,
        responses={
            201: SOURCE_RESPONSE,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=ProjectExamples.ADD_SYMBOL_SOURCE,
    )
    def post(self, request: Request, project: Project) -> Response[Source]:
        """
        Add a custom symbol source to a project.
        """
        source = ProjectSymbolSources(project).add(request.data)
        return Response(source, status=201)

    @extend_schema(
        operation_id="updateProjectSymbolSource",
        summary="Update a Project's Symbol Source",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ProjectParams.source_id("The ID of the source to update.", True),
        ],
        request=SourceSerializer,
        responses={
            200: SOURCE_RESPONSE,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.UPDATE_SYMBOL_SOURCE,
    )
    def put(self, request: Request, project: Project) -> Response[Source]:
        """
        Update a custom symbol source in a project.
        """
        source = ProjectSymbolSources(project).replace(_source_id(request), request.data)
        return Response(source)
