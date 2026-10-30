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
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.base import (
    InvestigationArchivedError,
    OrganizationInvestigationCommentEndpoint,
    require_authenticated_user,
)
from sentry.investigations.endpoints.validators.comment import CommentUpdateValidator
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.serializers.comment import (
    InvestigationCommentSerializer,
    InvestigationCommentSerializerResponse,
)
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
class OrganizationInvestigationCommentDetailsEndpoint(OrganizationInvestigationCommentEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"PUT": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Update an Investigation Comment",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            InvestigationParams.COMMENT_ID,
        ],
        request=CommentUpdateValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationCommentResponse", InvestigationCommentSerializerResponse
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
        investigation: Notebook,
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
            comment, data=request.data, context={"investigation": investigation}
        )
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        comment = validator.save()
        return Response(serialize(comment, request.user, InvestigationCommentSerializer()))

    @extend_schema(
        operation_id="Delete an Investigation Comment",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            InvestigationParams.COMMENT_ID,
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
        investigation: Notebook,
        comment: NotebookComment,
    ) -> Response:
        """
        Delete a comment authored by the authenticated user. The investigation must be active.
        Returns no body. Requires the organizations:investigations feature and open organization
        membership.
        """
        if (error := check_is_author(request, comment)) is not None:
            return error
        if investigation.status == NotebookStatus.ARCHIVED:
            raise InvestigationArchivedError
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
