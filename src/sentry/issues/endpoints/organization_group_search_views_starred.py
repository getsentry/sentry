from django.contrib.auth.models import AnonymousUser
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.groupsearchviewstarred import GroupSearchViewStarredSerializer
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.users.models.user import User


class MemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read"],
    }


@region_silo_endpoint
class OrganizationGroupSearchViewsStarredEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (MemberPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Retrieve a list of starred views for the current organization member.
        """
        has_global_views = features.has("organizations:global-views", organization)

        default_project = None
        if not has_global_views:
            default_project = pick_default_project(organization, request.user)
            if default_project is None:
                return Response(
                    status=status.HTTP_400_BAD_REQUEST,
                    data={"detail": "You do not have access to any projects."},
                )

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=organization, user_id=request.user.id
        )

        return self.paginate(
            request=request,
            queryset=starred_views,
            order_by="position",
            on_results=lambda x: serialize(
                x,
                request.user,
                serializer=GroupSearchViewStarredSerializer(
                    has_global_views=has_global_views,
                    default_project=default_project,
                    organization=organization,
                ),
            ),
        )


def pick_default_project(org: Organization, user: User | AnonymousUser) -> int | None:
    user_teams = Team.objects.get_for_user(organization=org, user=user)
    user_team_ids = [team.id for team in user_teams]
    default_user_project = (
        Project.objects.get_for_team_ids(user_team_ids)
        .order_by("slug")
        .values_list("id", flat=True)
        .first()
    )
    return default_user_project
