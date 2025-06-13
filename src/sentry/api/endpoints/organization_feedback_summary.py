import logging

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
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
# Token limit is 1,048,576 tokens, see https://ai.google.dev/gemini-api/docs/models#gemini-2.0-flash
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

        Returns the summary of the user feedbacks. The user feedbacks can be filtered by:
        - A list of projects
        - The date range that they were first seen in (defaults to the last 7 days)

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :qparam int project: project IDs to filter by
        :qparam string statsPeriod: filter feedbacks by date range (e.g. "14d")
        :qparam string start: start date range (alternative to statsPeriod)
        :qparam string end: end date range (alternative to statsPeriod)
        :auth: required
        """

        # time.sleep(2.5)

        if not features.has(
            "organizations:user-feedback-ai-summaries", organization, actor=request.user
        ):
            return Response(status=403)

        try:
            start, end = get_date_range_from_stats_period(
                request.GET,
                # optional=False,
                # default_stats_period=timedelta(days=7),
            )
        except (InvalidParams, Exception):
            # print("wat on earth is going on, there seems to be a daterange parsing issue")
            raise ParseError(detail="Invalid or missing date range")

        # return Response(status=403)

        return Response(
            {
                "summary": "This is a test summary that is being used to test the feedback summary frontend view, since we don't have the LLM set up here. I am making this purposefully long just to see if it will add an option to read more.",
                "success": True,
                "num_feedbacks_used": 10,
            }
        )

        filters = {
            "type": FeedbackGroup.type_id,
            "first_seen__gte": start,
            "first_seen__lte": end,
            "status": GroupStatus.UNRESOLVED,
            "project__in": self.get_projects(request, organization),
        }

        groups = Group.objects.filter(**filters).order_by("-first_seen")[
            :MAX_FEEDBACKS_TO_SUMMARIZE
        ]

        if groups.count() < MIN_FEEDBACKS_TO_SUMMARIZE:
            logger.error("Too few feedbacks to summarize")
            return Response({"summary": None, "success": False, "num_feedbacks_used": 0})

        # Also cap the number of characters that we send to the LLM
        group_feedbacks = []
        total_chars = 0
        for group in groups:
            total_chars += len(group.data["metadata"]["message"])
            if total_chars > MAX_FEEDBACKS_TO_SUMMARIZE_CHARS:
                break
            group_feedbacks.append(group.data["metadata"]["message"])

        # Edge case
        if len(group_feedbacks) < MIN_FEEDBACKS_TO_SUMMARIZE:
            logger.error("Too few feedbacks to summarize after enforcing the character limit")

        try:
            summary = generate_summary(group_feedbacks)
        except Exception:
            # Similar to create_feedback.py, just catch all exceptions until we have LLM error types ironed out
            logger.exception("Error generating summary of user feedbacks")
            return Response({"detail": "Error generating summary"}, status=500)

        return Response(
            {"summary": summary, "success": True, "num_feedbacks_used": len(group_feedbacks)}
        )
