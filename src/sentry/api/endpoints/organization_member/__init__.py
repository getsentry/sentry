from __future__ import annotations

from typing import Collection, TypedDict

from django.db import transaction
from rest_framework.request import Request

from sentry import roles
from sentry.api.exceptions import SentryAPIException, status
from sentry.auth.access import Access
from sentry.auth.superuser import is_active_superuser
from sentry.models import Organization, OrganizationMember, OrganizationMemberTeam, Team, TeamStatus
from sentry.roles.manager import Role, TeamRole


class InvalidTeam(SentryAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "invalid_team"
    message = "The team slug does not match a team in the organization"


class TeamRoleDict(TypedDict):
    teamSlug: str
    role: str


@transaction.atomic
def save_team_assignments(
    organization_member: OrganizationMember,
    teams: list[str] | None,
    teams_with_roles: list[TeamRoleDict] | None = None,
):
    if teams_with_roles is not None:
        team_slugs = [item["teamSlug"] for item in teams_with_roles]
    elif teams is not None:
        team_slugs = teams
    else:
        team_slugs = []

    target_teams = list(
        Team.objects.filter(
            organization=organization_member.organization,
            status=TeamStatus.VISIBLE,
            slug__in=team_slugs,
        )
    )
    if len(target_teams) != len(set(team_slugs)):
        raise InvalidTeam

    # Avoids O(n * n) search later
    team_role_map = (
        {item["teamSlug"]: item["role"] for item in teams_with_roles} if teams_with_roles else {}
    )

    new_assignments = [(team, team_role_map.get(team.slug, None)) for team in target_teams]

    OrganizationMemberTeam.objects.filter(organizationmember=organization_member).delete()
    OrganizationMemberTeam.objects.bulk_create(
        [
            OrganizationMemberTeam(organizationmember=organization_member, team=team, role=role)
            for team, role in new_assignments
        ]
    )


def can_set_team_role(access: Access, team: Team, new_role: TeamRole) -> bool:
    if not can_admin_team(access, team):
        return False

    org_role = access.get_organization_role()
    if org_role and org_role.can_manage_team_role(new_role):
        return True

    team_role = access.get_team_role(team)
    if team_role and team_role.can_manage(new_role):
        return True

    return False


def can_admin_team(access: Access, team: Team) -> bool:
    if access.has_scope("org:write"):
        return True
    if not access.has_team_membership(team):
        return False
    return access.has_team_scope(team, "team:write")


def get_allowed_org_roles(
    request: Request,
    organization: Organization,
    member: OrganizationMember | None = None,
) -> Collection[Role]:
    """Get the set of org-level roles that the request is allowed to manage.

    In order to change another member's role, the returned set must include both
    the starting role and the new role. That is, the set contains the roles that
    the request is allowed to promote someone to and to demote someone from.
    """

    if is_active_superuser(request):
        return roles.get_all()
    if not request.access.has_scope("member:admin"):
        return ()

    if member is None:
        try:
            member = OrganizationMember.objects.get(user=request.user, organization=organization)
        except OrganizationMember.DoesNotExist:
            # This can happen if the request was authorized by an app integration
            # token whose proxy user does not have an OrganizationMember object.
            return ()

    return member.get_allowed_org_roles_to_invite()


from .details import OrganizationMemberDetailsEndpoint
from .index import OrganizationMemberIndexEndpoint
from .requests.invite.details import OrganizationInviteRequestDetailsEndpoint
from .requests.invite.index import OrganizationInviteRequestIndexEndpoint
from .requests.join import OrganizationJoinRequestEndpoint

__all__ = (
    "OrganizationInviteRequestDetailsEndpoint",
    "OrganizationInviteRequestIndexEndpoint",
    "OrganizationJoinRequestEndpoint",
    "OrganizationMemberDetailsEndpoint",
    "OrganizationMemberIndexEndpoint",
    "get_allowed_org_roles",
    "save_team_assignments",
)
