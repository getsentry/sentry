from datetime import timedelta

from iniconfig import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationUserReportsPermission
from sentry.api.utils import get_date_range_from_stats_period
from sentry.exceptions import InvalidParams
from sentry.feedback.usecases.feedback_summaries import generate_summary
from sentry.issues.grouptype import FeedbackGroup
from sentry.models.group import Group
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationFeedbackSummaryEndpoint(OrganizationEndpoint):
    owner = ApiOwner.FEEDBACK
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,  # is this private or experimental?
    }
    permission_classes = (OrganizationUserReportsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get the summary of the user feedbacks of an organization
        ``````````````````````````````````````````````````

        Returns the summary of the user feedbacks. The user feedbacks can be filtered by a list of projects and the date range that they were created in.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """

        # stolen from organization_group_index.py
        try:
            start, end = get_date_range_from_stats_period(
                request.GET,
                optional=False,
                default_stats_period=timedelta(days=7),
            )
        except InvalidParams as e:
            raise ParseError(detail=str(e))

        groups = Group.objects.filter(
            project__in=self.get_projects(request, organization),
            type=FeedbackGroup.type_id,
            first_seen__gte=start,
            first_seen__lte=end,
        )

        # Experiment with this number; it also depends on the quality of the feedbacks and the diversity of topics that they touch upon
        if groups.count() <= 8:
            return Response({"summary": "null", "sucesss": False})

        group_feedbacks = [group.data["metadata"]["message"] for group in groups]

        try:
            summary = generate_summary(group_feedbacks)
        except Exception:
            # No need to log here maybe? Parse errors are being logged in parse_response
            return Response({"detail": "Error generating summary"}, status=500)

        # Maybe pass the number of feedbacks that were used to generate the summary, since we have to cap the text length, and how to do we surface this to the user?
        return Response({"summary": summary, "success": True})
