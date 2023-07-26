from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamWithProjectsSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.models import Team, TeamStatus


@region_silo_endpoint
class OrganizationUserTeamsEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization) -> Response:
        """
        List your Teams In the Current Organization
        ```````````````````````````````````````````

        Return a list of the teams available to the authenticated session and
        with the supplied organization. If the user is a super user, then all
        teams within the organization are returned.
        """
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
