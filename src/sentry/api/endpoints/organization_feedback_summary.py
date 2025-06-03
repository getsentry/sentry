from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationUserReportsPermission
from sentry.feedback.usecases.summaries import generate_summary
from sentry.issues.grouptype import FeedbackGroup
from sentry.models.group import Group
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationFeedbackSummaryEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationUserReportsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get summary and key sentiments of the user feedbacks of a given organization
        ``````````````````````````````````````````````````

        Returns a tuple of summary and key sentiments. (TODO: write more, about which feedbacks we take, etc.)

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """

        groups = list(
            Group.objects.filter(
                project__in=self.get_projects(request, organization), type=FeedbackGroup.type_id
            )
        )

        group_feedbacks = [group.message for group in groups]

        generate_summary(group_feedbacks)

        return Response("hi")
