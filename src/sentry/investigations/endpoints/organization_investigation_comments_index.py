from __future__ import annotations

from django.db.models import Q
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
)
from sentry.investigations.endpoints.serializers.comment import (
    InvestigationCommentSerializer,
    InvestigationCommentSerializerResponse,
)
from sentry.investigations.endpoints.validators.comment import (
    CommentCreateValidator,
    CommentListValidator,
)
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook, NotebookComment


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCommentsEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="List Investigation Comments",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            CommentListValidator,
            InvestigationParams.CURSOR,
            InvestigationParams.PER_PAGE,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListInvestigationCommentsResponse", list[InvestigationCommentSerializerResponse]
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization, investigation: Notebook
    ) -> Response:
        """
        List comments newest first as a paginated array. Optionally filter to one block using
        blockId. Follow the Link header for more results. Requires the
        organizations:investigations feature and open organization membership.
        """
        # A deleted block's comments are hidden, and come back if Seer restores the block.
        comments = NotebookComment.objects.filter(notebook=investigation).filter(
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

    @extend_schema(
        operation_id="Create an Investigation Comment",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, InvestigationParams.INVESTIGATION_ID],
        request=CommentCreateValidator,
        responses={
            201: inline_sentry_response_serializer(
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
                value={"body": "Latency increased after the deployment."},
                request_only=True,
            )
        ],
    )
    def post(
        self, request: Request, organization: Organization, investigation: Notebook
    ) -> Response:
        """
        Add a comment to the investigation or an active block. Requires an authenticated user
        and an active investigation. Returns the new comment with its author and timestamps.
        Requires the organizations:investigations feature and open organization membership.
        """
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
