from __future__ import annotations

from django.db.models import F
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization_events import OrganizationEventsV2EndpointBase
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.replay_examples import ReplayExamples
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.replays.usecases.replay_counts import get_replay_counts
from sentry.snuba.dataset import Dataset
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class ReplayCountQueryParamsValidator(serializers.Serializer):
    query = serializers.CharField(required=True)
    data_source = serializers.ChoiceField(
        choices=(Dataset.Discover.value, Dataset.IssuePlatform.value),
        default=Dataset.Discover.value,
    )
    returnIds = serializers.BooleanField(default=False)


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class OrganizationReplayCountEndpoint(OrganizationEventsV2EndpointBase):
    """
    Get all the replay ids associated with a set of issues/transactions in discover,
    then verify that they exist in the replays dataset, and return the count.
    """

    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=20, window=1),
            RateLimitCategory.USER: RateLimit(limit=20, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=20, window=1),
        }
    }

    @extend_schema(
        examples=ReplayExamples.GET_REPLAY_COUNTS,
        operation_id="Retrieve a Count of Replays for a Given Issue or Transaction",
        parameters=[
            GlobalParams.ENVIRONMENT,
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.START,
            GlobalParams.END,
            GlobalParams.STATS_PERIOD,
            OrganizationParams.PROJECT,
            VisibilityParams.QUERY,
        ],
        responses={
            200: inline_sentry_response_serializer("ReplayCounts", dict[int, int]),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """Return a count of replays for a list of issue or transaction IDs.

        The `query` parameter is required. It is a search query that includes exactly one of `issue.id`, `transaction`, or `replay_id` (string or list of strings).
        """
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response({})

        if not project_in_org_has_sent_replay(organization):
            return Response({})

        validator = ReplayCountQueryParamsValidator(data=request.GET)
        if not validator.is_valid():
            raise ParseError(validator.errors)
        query_params = validator.validated_data

        try:
            replay_counts = get_replay_counts(
                snuba_params,
                query_params["query"],
                query_params["returnIds"],
                query_params["data_source"],
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
