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
    NotebookArchivedError,
    OrganizationNotebookCommentEndpoint,
    require_authenticated_user,
)
from sentry.notebooks.endpoints.serializers.comment import (
    NotebookCommentSerializer,
    NotebookCommentSerializerResponse,
)
from sentry.notebooks.endpoints.validators.comment import CommentUpdateValidator
from sentry.notebooks.models import Notebook, NotebookComment, NotebookStatus


def check_is_author(request: Request, comment: NotebookComment) -> Response | None:
    if comment.author_id != require_authenticated_user(request):
        return Response(
            {"detail": "Only the author can change a comment."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationNotebookCommentDetailsEndpoint(OrganizationNotebookCommentEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"PUT": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Update an Investigation Comment",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            NotebookParams.NOTEBOOK_ID,
            NotebookParams.COMMENT_ID,
        ],
        request=CommentUpdateValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationCommentResponse", NotebookCommentSerializerResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                "Example request",
                value={"body": "Latency increased immediately after the deployment."},
                request_only=True,
            )
        ],
    )
    def put(
        self,
        request: Request,
        organization: Organization,
        notebook: Notebook,
        comment: NotebookComment,
    ) -> Response:
        """
        Replace the comment body. Only the author can edit it; the investigation must be active.
        Returns the updated comment. Requires the organizations:investigations feature and open
        organization membership.
        """
        if (error := check_is_author(request, comment)) is not None:
            return error
        validator = CommentUpdateValidator(
            comment, data=request.data, context={"notebook": notebook}
        )
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        comment = validator.save()
        return Response(serialize(comment, request.user, NotebookCommentSerializer()))

    @extend_schema(
        operation_id="Delete an Investigation Comment",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            NotebookParams.NOTEBOOK_ID,
            NotebookParams.COMMENT_ID,
        ],
        request=None,
        responses={
            204: constants.RESPONSE_NO_CONTENT,
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self,
        request: Request,
        organization: Organization,
        notebook: Notebook,
        comment: NotebookComment,
    ) -> Response:
        """
        Delete a comment authored by the authenticated user. The investigation must be active.
        Returns no body. Requires the organizations:investigations feature and open organization
        membership.
        """
        if (error := check_is_author(request, comment)) is not None:
            return error
        if notebook.status == NotebookStatus.ARCHIVED:
            raise NotebookArchivedError
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
