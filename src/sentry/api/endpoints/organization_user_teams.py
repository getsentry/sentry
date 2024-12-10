from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamWithProjectsSerializer
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.team_examples import TeamExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.superuser import is_active_superuser
from sentry.models.team import Team, TeamStatus


@extend_schema(tags=["Teams"])
@region_silo_endpoint
class OrganizationUserTeamsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ENTERPRISE

    @extend_schema(
        operation_id="List a User's Teams for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListOrgTeamResponse", list[TeamWithProjectsSerializer]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=TeamExamples.LIST_ORG_TEAMS,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Returns a list of teams the user has access to in the specified organization.
        Note that this endpoint is restricted to [user auth tokens](https://docs.sentry.io/account/auth-tokens/#user-auth-tokens).
        """
        # Return a list of the teams available to the authenticated session and
        # with the supplied organization. If the user is a super user, then all
        # teams within the organization are returned.
        if is_active_superuser(request):
            # retrieve all teams within the organization
            queryset = Team.objects.filter(
                organization=organization, status=TeamStatus.ACTIVE
            ).order_by("slug")
        else:
            queryset = Team.objects.filter(
                organization=organization,
                status=TeamStatus.ACTIVE,
                id__in=request.access.team_ids_with_membership,
            ).order_by("slug")
        return Response(serialize(list(queryset), request.user, TeamWithProjectsSerializer()))
