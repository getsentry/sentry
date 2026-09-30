from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationCommentEndpoint,
    require_authenticated_user,
)
from sentry.investigations.endpoints.serializers.comment import InvestigationCommentSerializer
from sentry.investigations.endpoints.validators.comment import CommentUpdateValidator
from sentry.investigations.models import Investigation, InvestigationComment, InvestigationStatus
from sentry.models.organization import Organization


def check_is_author(request: Request, comment: InvestigationComment) -> Response | None:
    if comment.author_id != require_authenticated_user(request):
        return Response(
            {"detail": "Only the author can change a comment."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCommentDetailsEndpoint(OrganizationInvestigationCommentEndpoint):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}

    def put(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        comment: InvestigationComment,
    ) -> Response:
        if (error := check_is_author(request, comment)) is not None:
            return error
        validator = CommentUpdateValidator(
            comment, data=request.data, context={"investigation": investigation}
        )
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        comment = validator.save()
        return Response(serialize(comment, request.user, InvestigationCommentSerializer()))

    def delete(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        comment: InvestigationComment,
    ) -> Response:
        if (error := check_is_author(request, comment)) is not None:
            return error
        if investigation.status == InvestigationStatus.ARCHIVED:
            return Response(
                {"detail": "Archived investigations are read-only."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
