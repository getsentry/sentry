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
    NotebookBlockSerializer,
    NotebookBlockSerializerResponse,
)
from sentry.notebooks.endpoints.validators import BlockCreateValidator
from sentry.notebooks.models import Notebook
from sentry.seer.agent_token import is_agent_auth
from sentry.service_accounts.auth import is_service_account_auth


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationNotebookBlockIndexEndpoint(OrganizationNotebookEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PUBLIC_EXPERIMENTAL}
    idempotent_methods = frozenset()

    @extend_schema(
        operation_id="Create a Notebook Block",
        tags=["Notebooks"],
        parameters=[GlobalParams.ORG_ID_OR_SLUG, NotebookParams.NOTEBOOK_ID],
        request=BlockCreateValidator,
        responses={
            200: inline_sentry_response_serializer(
                "NotebookBlockResponse", NotebookBlockSerializerResponse
            ),
            201: inline_sentry_response_serializer(
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
                value={
                    "notebookVersion": 1,
                    "kind": "text",
                    "content": "Initial observations",
                },
                request_only=True,
            ),
            OpenApiExample(
                "Example producer request",
                value={
                    "key": "summary",
                    "revision": 1,
                    "kind": "text",
                    "content": "Root cause: a slow database query.",
                },
                request_only=True,
            ),
        ]
        + NotebookExamples.CREATE_BLOCK,
    )
    def post(
        self, request: Request, organization: Organization, notebook: Notebook
    ) -> (
        Response[NotebookBlockSerializerResponse]
        | Response[ValidationErrorResponse]
        | Response[DetailResponse]
    ):
        """
        Append a text or query block to an active investigation, using notebookVersion for
        concurrency. A producer sends key and revision instead to write its text block: the
        same key updates the block, overwriting user edits and bringing back a deleted block,
        and a block with a newer revision returns 409. Returns 201 with the new block, or 200
        when a producer's write updates one; fetch investigation details for the updated
        notebook version. Requires a user or service account; key and revision require a
        service account or Seer agent token. Requires the
        organizations:investigations feature and open organization membership.
        """
        actor_id = require_notebook_writer(request, notebook)
        validator = BlockCreateValidator(
            data=request.data,
            context={
                "notebook": notebook,
                "user_id": actor_id,
                "producer_writer": is_service_account_auth(request.auth)
                or is_agent_auth(request.auth),
            },
        )
        if not validator.is_valid():
            return Response(as_validation_errors(validator), status=status.HTTP_400_BAD_REQUEST)
        try:
            block, created = validator.save()
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise

        return Response(
            serialize(
                block,
                request.user,
                NotebookBlockSerializer(),
            ),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
