from __future__ import annotations

from django.db.models import F
from rest_framework import serializers, status
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from snuba_sdk import Request

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization_events import OrganizationEventsV2EndpointBase
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.replays.usecases.replay_counts import get_replay_counts
from sentry.snuba.dataset import Dataset
from sentry.types.ratelimit import RateLimit, RateLimitCategory

MAX_REPLAY_COUNT = 51
MAX_VALS_PROVIDED = {
    "issue.id": 25,
    "transaction": 25,
    "replay_id": 100,
}

FILTER_HAS_A_REPLAY = "AND !replayId:''"


class ReplayDataSourceValidator(serializers.Serializer):
    data_source = serializers.ChoiceField(
        choices=(Dataset.Discover.value, Dataset.IssuePlatform.value),
        default=Dataset.Discover.value,
    )


@region_silo_endpoint
class OrganizationReplayCountEndpoint(OrganizationEventsV2EndpointBase):
    """
    Get all the replay ids associated with a set of issues/transactions in discover,
    then verify that they exist in the replays dataset, and return the count.
    """

    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(20, 1),
            RateLimitCategory.USER: RateLimit(20, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(20, 1),
        }
    }

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)

        try:
            snuba_params, _ = self.get_snuba_dataclass(
                request, organization, check_global_views=False
            )
        except NoProjects:
            return Response({})

        if features.has(
            "organizations:session-replay-count-query-optimize", organization, actor=request.user
        ):
            if not project_in_org_has_sent_replay(organization):
                return Response({})

        result = ReplayDataSourceValidator(data=request.GET)
        if not result.is_valid():
            raise ParseError(result.errors)
        data_source = Dataset.Discover
        if result.validated_data["data_source"] == Dataset.IssuePlatform.value:
            data_source = Dataset.IssuePlatform
        try:
            replay_counts = get_replay_counts(
                snuba_params, request.GET.get("query"), request.GET.get("returnIds"), data_source
            )
        except (InvalidSearchQuery, ValueError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return self.respond(replay_counts)


def project_in_org_has_sent_replay(organization):
    return (
        Project.objects.filter(organization=organization)
        .filter(flags=F("flags").bitor(Project.flags.has_replays))
        .exists()
    )
