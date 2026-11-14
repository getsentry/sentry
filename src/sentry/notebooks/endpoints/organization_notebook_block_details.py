from __future__ import annotations

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
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
    OrganizationNotebookBlockEndpoint,
    require_notebook_writer,
    service_error,
)
from sentry.notebooks.endpoints.serializers import (
    NotebookBlockSerializer,
    NotebookBlockSerializerResponse,
)
from sentry.notebooks.endpoints.validators import BlockDeleteValidator, BlockUpdateValidator
from sentry.notebooks.models import Notebook, NotebookBlock
from sentry.notebooks.services import delete_block, update_block


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationNotebookBlockDetailsEndpoint(OrganizationNotebookBlockEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "PUT": ApiPublishStatus.PUBLIC_EXPERIMENTAL,
        "DELETE": ApiPublishStatus.PUBLIC_EXPERIMENTAL,
    }
    idempotent_methods = frozenset()

    @extend_schema(
        operation_id="Update a Notebook Block",
        tags=["Notebooks"],
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            NotebookParams.NOTEBOOK_ID,
            NotebookParams.BLOCK_ID,
        ],
        request=BlockUpdateValidator,
        responses={
            200: inline_sentry_response_serializer(
                "NotebookBlockResponse", NotebookBlockSerializerResponse
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
                value={"notebookVersion": 2, "version": 1, "content": "Revised observations"},
                request_only=True,
            )
        ]
        + NotebookExamples.BLOCK_DETAILS,
    )
    def put(
        self,
        request: Request,
        organization: Organization,
        notebook: Notebook,
        block: NotebookBlock,
    ) -> (
        Response[NotebookBlockSerializerResponse]
        | Response[ValidationErrorResponse]
        | Response[DetailResponse]
    ):
        """
        Update at least one of title, content, generationPrompt, config, or display. Send both
        notebook and block versions. The block kind cannot change. Returns the updated block.
        Requires a user or service account. Requires the organizations:investigations feature
        and open organization membership.
        """
        actor_id = require_notebook_writer(request, notebook)
        if block.deleted_at is not None:
            raise ResourceDoesNotExist

        validator = BlockUpdateValidator(data=request.data, context={"block": block})
        if not validator.is_valid():
            return Response(as_validation_errors(validator), status=status.HTTP_400_BAD_REQUEST)

        values = dict(validator.validated_data)
        expected_notebook_version = values.pop("notebook_version")
        expected_block_version = values.pop("version")
        if "generation_prompt" in values:
            values["prompt"] = values.pop("generation_prompt")
        try:
            updated = update_block(
                block=block,
                expected_notebook_version=expected_notebook_version,
                expected_block_version=expected_block_version,
                user_id=actor_id,
                values=values,
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
                NotebookBlockSerializer(),
            )
        )

    @extend_schema(
        operation_id="Delete a Notebook Block",
        tags=["Notebooks"],
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            NotebookParams.NOTEBOOK_ID,
            NotebookParams.BLOCK_ID,
        ],
        request=BlockDeleteValidator,
        responses={
            204: constants.RESPONSE_NO_CONTENT,
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
            409: constants.RESPONSE_CONFLICT,
        },
        examples=[
            OpenApiExample(
                "Example request",
                value={"notebookVersion": 2, "version": 1},
                request_only=True,
            )
        ],
    )
    def delete(
        self,
        request: Request,
        organization: Organization,
        notebook: Notebook,
        block: NotebookBlock,
    ) -> Response[None] | Response[ValidationErrorResponse] | Response[DetailResponse]:
        """
        Soft-delete an active block using notebook and block versions. Active executions and
        other state conflicts return 409. Returns no body. Requires a user or service account.
        Requires the organizations:investigations feature and open organization membership.
        """
        require_notebook_writer(request, notebook)
        if block.deleted_at is not None:
            raise ResourceDoesNotExist

        validator = BlockDeleteValidator(data=request.data)
        if not validator.is_valid():
            return Response(as_validation_errors(validator), status=status.HTTP_400_BAD_REQUEST)
        try:
            delete_block(
                block=block,
                expected_notebook_version=validator.validated_data["notebook_version"],
                expected_block_version=validator.validated_data["version"],
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise

        return Response(status=status.HTTP_204_NO_CONTENT)
