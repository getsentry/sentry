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
from sentry.apidocs.examples.notebook_examples import NotebookExamples
from sentry.apidocs.parameters import GlobalParams, NotebookParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import (
    OrganizationNotebookEndpoint,
    require_notebook_writer,
    service_error,
)
from sentry.notebooks.endpoints.serializers import (
    NotebookDetailsSerializer,
    NotebookDetailsSerializerResponse,
)
from sentry.notebooks.endpoints.validators import BlockOrderValidator
from sentry.notebooks.models import Notebook
from sentry.notebooks.services import reorder_blocks


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationNotebookBlockOrderEndpoint(OrganizationNotebookEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"PUT": ApiPublishStatus.PUBLIC_EXPERIMENTAL}
    idempotent_methods = frozenset()

    @extend_schema(
        operation_id="Reorder Notebook Blocks",
        tags=["Notebooks"],
        parameters=[GlobalParams.ORG_ID_OR_SLUG, NotebookParams.NOTEBOOK_ID],
        request=BlockOrderValidator,
        responses={
            200: inline_sentry_response_serializer(
                "NotebookDetailsResponse", NotebookDetailsSerializerResponse
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
                value={"notebookVersion": 3, "blockIds": [2, 1]},
                request_only=True,
            )
        ]
        + NotebookExamples.NOTEBOOK_DETAILS,
    )
    def put(
        self, request: Request, organization: Organization, notebook: Notebook
    ) -> (
        Response[NotebookDetailsSerializerResponse]
        | Response[ValidationErrorResponse]
        | Response[DetailResponse]
    ):
        """
        Set the order of all active blocks. Supply every active block ID exactly once and the
        current notebook version. Returns the updated notebook with ordered blocks. Requires a
        user or service account. Requires the organizations:investigations feature and open
        organization membership.
        """
        require_notebook_writer(request, notebook)
        validator = BlockOrderValidator(data=request.data)
        if not validator.is_valid():
            return Response(as_validation_errors(validator), status=status.HTTP_400_BAD_REQUEST)
        try:
            updated = reorder_blocks(
                notebook=notebook,
                expected_version=validator.validated_data["notebook_version"],
                block_ids=validator.validated_data["block_ids"],
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise

        body: NotebookDetailsSerializerResponse = serialize(
            updated,
            request.user,
            NotebookDetailsSerializer(access=request.access),
        )
        return Response(body)
