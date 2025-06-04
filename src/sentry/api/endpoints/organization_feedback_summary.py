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

        res = {
            "summary": "User appreciate that the app is fast and easy to use, but there are some UI bugs",
            "key_sentiments": [
                {"value": "Fast", "type": "positive"},
                {"value": "Easy to use", "type": "positive"},
                {"value": "UI bugs", "type": "negative"},
            ],
        }

        # without an openai API key, we'll just return a sample response for now
        return Response(res)

        # stolen from organization_group_index.py
        try:
            start, end = get_date_range_from_stats_period(request.GET)
        except InvalidParams as e:
            raise ParseError(detail=str(e))

        groups = Group.objects.filter(
            project__in=self.get_projects(request, organization),
            type=FeedbackGroup.type_id,  # filter on the list of projects that the user has selected in the frontend
        )  # we take all feedbacks for now, but need to add filters for start and end dates

        group_feedbacks = [group.message for group in groups]

        # TODO: chatgpt generates BS if there are no feedbacks, maybe return some other status / response if there are less than 5 feedbacks
        summary = generate_summary(group_feedbacks)

        if not summary[0]:  # parsing wasn't successful
            return Response(
                {"detail": "Error generating summary"}, status=500
            )  # TODO: add more details to the error message and add logging

        res = {"summary": summary[1], "key_sentiments": summary[2]}

        return Response(res)
