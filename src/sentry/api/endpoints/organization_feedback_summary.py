import logging
from datetime import timedelta

from rest_framework.exceptions import ParseError
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
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization

logger = logging.getLogger(__name__)

MIN_FEEDBACKS_TO_SUMMARIZE = 10
MAX_FEEDBACKS_TO_SUMMARIZE = 1000
# The input token limit for the model is 1,048,576 tokens, see https://ai.google.dev/gemini-api/docs/models#gemini-2.0-flash
MAX_FEEDBACKS_TO_SUMMARIZE_CHARS = 1000000


@region_silo_endpoint
class OrganizationFeedbackSummaryEndpoint(OrganizationEndpoint):
    owner = ApiOwner.FEEDBACK
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
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

        # TODO: add a feature flag for this endpoint

        # stolen from organization_group_index.py
        try:
            start, end = get_date_range_from_stats_period(
                request.GET,
                optional=False,
                default_stats_period=timedelta(days=7),
            )
        except InvalidParams as e:
            raise ParseError(detail=str(e))

        # Build base query filters
        filters = {
            "type": FeedbackGroup.type_id,
            "first_seen__gte": start,
            "first_seen__lte": end,
            "status__in": [
                GroupStatus.RESOLVED,
                GroupStatus.UNRESOLVED,
            ],
        }

        # Only filter by projects if projects are explicitly selected
        projects = self.get_projects(request, organization)
        if request.GET.get(
            "project"
        ):  # Only add project filter if projects were specified in the request
            filters["project__in"] = projects

        groups = Group.objects.filter(**filters).order_by("-first_seen")[
            :MAX_FEEDBACKS_TO_SUMMARIZE
        ]

        # Experiment with this number; it also depends on the quality of the feedbacks and the diversity of topics that they touch upon
        if groups.count() <= MIN_FEEDBACKS_TO_SUMMARIZE:
            return Response({"summary": None, "success": False, "num_feedbacks_used": 0})

        # A limit of 1000 feedbacks already exists, but we also want to cap the number of characters that we send to the LLM
        group_feedbacks = []
        total_chars = 0
        for group in groups:
            total_chars += len(group.data["metadata"]["message"])
            if total_chars > MAX_FEEDBACKS_TO_SUMMARIZE_CHARS:
                break
            group_feedbacks.append(group.data["metadata"]["message"])

        try:
            summary = generate_summary(group_feedbacks)
        except Exception:
            # check create_feedback.py, just catch all exceptions until we have LLM error types ironed out
            logger.exception("Error generating summary of user feedbacks")
            return Response({"detail": "Error generating summary"}, status=500)

        # Maybe pass the number of feedbacks that were used to generate the summary, since we have to cap the text length, and how do we surface this to the user?
        return Response(
            {"summary": summary, "success": True, "num_feedbacks_used": len(group_feedbacks)}
        )
