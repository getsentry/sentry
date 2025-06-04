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
from sentry.feedback.usecases.summaries import generate_summary
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

        res = {
            "summary": "User appreciate that the app is fast and easy to use and that features are working well. Some users are experiencing UI issues with the app, such as the navigation bar not being visible.",
        }

        # stolen from organization_group_index.py
        try:
            # default is one week
            start, end = get_date_range_from_stats_period(
                request.GET, optional=False, default_stats_period=timedelta(days=1)
            )
        except InvalidParams as e:
            raise ParseError(detail=str(e))

        groups = Group.objects.filter(
            project__in=self.get_projects(request, organization),
            type=FeedbackGroup.type_id,
            first_seen__gte=start,  # is this an expensive query? (querying for gte / lte)
            first_seen__lte=end,
        )

        # group.message includes "User Feedback" and the URL and we don't want to pass that to the LLM - check augment_message_with_occurrence for how they get added to message
        # thus, we use group.data["metadata"]["message"] instead of group.message which contains only the message that the user wrote
        group_feedbacks = [group.data["metadata"]["message"] for group in groups]

        # for f in group_feedbacks:
        #     print(f)

        # without an openai API key, we'll just return a sample response
        # return Response(res)

        # TODO: chatgpt generates BS if there are no feedbacks, maybe return some other status / response if there are less than 5 feedbacks to just hide the summary
        # there is a max token limit for the LLM, we also need to find the max number of feedbacks (starting from the most recent) that can be sent to the LLM, can we filter for that or maybe binary search after getting all feedbacks in the given time period?
        try:
            summary = generate_summary(
                group_feedbacks
            )  # if this throws an error, we should return 500
        except Exception:
            return Response(
                {"detail": "Error generating summary"}, status=500
            )  # TODO: add more details to the error message and add logging

        res = {"summary": summary}

        return Response(res)
