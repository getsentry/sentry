from __future__ import annotations

from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
)
from sentry.investigations.endpoints.serializers.comment import InvestigationCommentSerializer
from sentry.investigations.endpoints.validators.comment import (
    CommentCreateValidator,
    CommentListValidator,
)
from sentry.investigations.models import Investigation, InvestigationComment
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCommentsEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}

    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        # A deleted block's comments are hidden, and come back if Seer restores the block.
        comments = InvestigationComment.objects.filter(investigation=investigation).filter(
            Q(block__isnull=True) | Q(block__deleted_at__isnull=True)
        )
        validator = CommentListValidator(data=request.GET)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        if "blockId" in validator.validated_data:
            comments = comments.filter(block_id=validator.validated_data["blockId"])
        return self.paginate(
            request=request,
            queryset=comments,
            paginator_cls=DateTimePaginator,
            order_by="-date_added",
            on_results=lambda results: serialize(
                list(results), request.user, InvestigationCommentSerializer()
            ),
        )

    def post(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        author_id = require_authenticated_user(request)
        validator = CommentCreateValidator(
            data=request.data, context={"investigation": investigation}
        )
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        comment = validator.save(author_id=author_id)
        return Response(
            serialize(comment, request.user, InvestigationCommentSerializer()),
            status=status.HTTP_201_CREATED,
        )
