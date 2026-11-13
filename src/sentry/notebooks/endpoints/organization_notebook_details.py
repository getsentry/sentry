from __future__ import annotations

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, NotebookParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import (
    OrganizationNotebookEndpoint,
    request_creator_actor,
    require_notebook_writer,
    require_project_access,
    service_error,
    writable_project_ids,
)
from sentry.notebooks.endpoints.serializers import (
    NotebookDetailsSerializer,
    NotebookDetailsSerializerResponse,
)
from sentry.notebooks.endpoints.validators import (
    NotebookDeleteValidator,
    NotebookUpdateValidator,
)
from sentry.notebooks.models import Notebook, NotebookStatus
from sentry.notebooks.services.producer import archive_notebook, update_notebook


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationNotebookDetailsEndpoint(OrganizationNotebookEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="Retrieve an Investigation",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, NotebookParams.NOTEBOOK_ID],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationDetailsResponse", NotebookDetailsSerializerResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization, notebook: Notebook) -> Response:
        """
        Return notebook metadata, source context, filters, project IDs, parameter definitions
        and saved values, and ordered active blocks. Poll this endpoint for notebook and block
        output updates. Requires the organizations:investigations feature and open organization
        membership.
        """
        return Response(
            serialize(
                notebook,
                request.user,
                NotebookDetailsSerializer(access=request.access),
            )
        )

    @extend_schema(
        operation_id="Update an Investigation",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, NotebookParams.NOTEBOOK_ID],
        request=NotebookUpdateValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationDetailsResponse", NotebookDetailsSerializerResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
            409: constants.RESPONSE_CONFLICT,
        },
        examples=[
            OpenApiExample(
                "Example request",
                value={"investigationVersion": 1, "title": "Checkout latency analysis"},
                request_only=True,
            )
        ],
    )
    def put(self, request: Request, organization: Organization, notebook: Notebook) -> Response:
        """
        Update title, filters, project selection, or status using investigationVersion. Archived
        notebooks allow only a standalone restore to active; source-backed investigations cannot
        be restored. Archive as a standalone status change. Stale versions or incompatible
        execution state return 409. Returns the updated notebook. Requires a user or service
        account. Requires the organizations:investigations feature and open organization
        membership.
        """
        require_notebook_writer(request, notebook)
        validator = NotebookUpdateValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        values = dict(validator.validated_data)
        expected_version = values.pop("investigation_version")
        requested_project_ids = values.pop("project_ids", None)
        if requested_project_ids is not None and not set(requested_project_ids).issubset(
            writable_project_ids(request, organization)
        ):
            return Response(
                {"detail": "One or more projects are inaccessible."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if requested_project_ids is not None:
            require_project_access(request, requested_project_ids)
        restoring_only = (
            values == {"status": NotebookStatus.ACTIVE} and requested_project_ids is None
        )
        if notebook.status == NotebookStatus.ARCHIVED and not restoring_only:
            return Response(
                {"detail": "Archived investigations are read-only."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if values.get("status") == NotebookStatus.ARCHIVED:
            if set(values) != {"status"} or requested_project_ids is not None:
                return Response(
                    {"detail": "Archiving cannot be combined with other changes."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                archived = archive_notebook(
                    notebook=notebook,
                    expected_version=expected_version,
                    actor=request_creator_actor(request),
                )
            except Exception as error:
                response = service_error(error)
                if response is not None:
                    return response
                raise
            return Response(
                serialize(
                    archived,
                    request.user,
                    NotebookDetailsSerializer(access=request.access),
                )
            )
        try:
            updated = update_notebook(
                notebook=notebook,
                expected_version=expected_version,
                fields=values,
                project_ids=requested_project_ids,
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            serialize(
                updated,
                request.user,
                NotebookDetailsSerializer(access=request.access),
            )
        )

    @extend_schema(
        operation_id="Archive an Investigation",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, NotebookParams.NOTEBOOK_ID],
        request=NotebookDeleteValidator,
        responses={
            204: constants.RESPONSE_NO_CONTENT,
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
            409: constants.RESPONSE_CONFLICT,
        },
        examples=[
            OpenApiExample("Example request", value={"investigationVersion": 1}, request_only=True)
        ],
    )
    def delete(self, request: Request, organization: Organization, notebook: Notebook) -> Response:
        """
        Archive rather than permanently delete the notebook. Send investigationVersion in the
        JSON body. Archiving an agentic investigation cancels its workflow; active manual block
        executions must first be stopped. Returns no body. Requires a user or service account.
        Requires the organizations:investigations feature and open organization membership.
        """
        require_notebook_writer(request, notebook)
        validator = NotebookDeleteValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            archive_notebook(
                notebook=notebook,
                expected_version=validator.validated_data["investigation_version"],
                actor=request_creator_actor(request),
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        return Response(status=status.HTTP_204_NO_CONTENT)
