from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.feedback.models import Feedback
from sentry.feedback.serializers import FeedbackSerializer
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationFeedbackIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FEEDBACK

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:user-feedback-ingest", organization, actor=request.user):
            return Response(status=404)

        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return Response([])

        feedback_list = Feedback.objects.filter(
            organization_id=organization.id,
            project_id__in=filter_params["project_id"],
        )

        if filter_params["start"] and filter_params["end"]:
            feedback_list = feedback_list.filter(
                date_added__range=(filter_params["start"], filter_params["end"])
            )

        if "environment" in filter_params:
            feedback_list = feedback_list.filter(
                environment__in=[env.id for env in filter_params["environment_objects"]]
            )

        return self.paginate(
            request=request,
            queryset=feedback_list,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user, FeedbackSerializer()),
            paginator_cls=OffsetPaginator,
            count_hits=True,
        )
