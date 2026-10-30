from __future__ import annotations

from django.db.models import Count
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.base import OrganizationInvestigationEndpoint
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook, NotebookComment


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCommentCountsEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Retrieve Investigation Block Comment Counts",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, InvestigationParams.INVESTIGATION_ID],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationCommentCountsResponse", dict[str, int]
            ),
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization, investigation: Notebook
    ) -> Response:
        """
        Return an object mapping block IDs to integer comment counts. Only active blocks with
        comments are included; investigation-level comments and deleted blocks are excluded.
        Returns an empty object when no block comments exist. Requires the
        organizations:investigations feature and open organization membership.
        """
        counts = (
            NotebookComment.objects.filter(
                notebook=investigation,
                block__isnull=False,
                block__deleted_at__isnull=True,
            )
            .values_list("block_id")
            .annotate(count=Count("id"))
        )
        return Response({str(block_id): count for block_id, count in counts})
