from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.feedback.models import Feedback
from sentry.feedback.serializers import FeedbackSerializer
from sentry.models import Organization


@region_silo_endpoint
class OrganizationFeedbackIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FEEDBACK

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:user-feedback-ingest", organization, actor=request.user):
            return Response(status=404)

        feedback_list = Feedback.objects.filter(organization_id=organization.id)
        return self.paginate(
            request=request,
            queryset=feedback_list,
            on_results=lambda x: serialize(x, request.user, FeedbackSerializer()),
            paginator_cls=OffsetPaginator,
        )
