from __future__ import annotations

from typing import Collection, List, Tuple

from django.db import transaction
from rest_framework.request import Request

from sentry import roles
from sentry.auth.superuser import is_active_superuser
from sentry.models import Organization, OrganizationMember, OrganizationMemberTeam, Team
from sentry.roles.manager import Role


@transaction.atomic
def save_team_assignments(
    organization_member: OrganizationMember,
    teams: List[Team] | None,
    teams_with_roles: List[Tuple[Team, str]] | None = None,
):
    if teams_with_roles:
        # Map will avoid O(n * n) search later
        team_role_map = {team.slug: role_id for team, role_id in teams_with_roles}
        target_teams = [team for team, _ in teams_with_roles]
    elif teams:
        team_role_map = {}
        target_teams = teams
    else:
        team_role_map = {}
        target_teams = []

    new_assignments = [(team, team_role_map.get(team.slug, None)) for team in target_teams]

    OrganizationMemberTeam.objects.filter(organizationmember=organization_member).delete()
    OrganizationMemberTeam.objects.bulk_create(
        [
            OrganizationMemberTeam(organizationmember=organization_member, team=team, role=role)
            for team, role in new_assignments
        ]
    )


def get_allowed_org_roles(
    request: Request,
    organization: Organization,
    member: OrganizationMember | None = None,
) -> Collection[Role]:
    """
    Get the set of org-level roles that the request is allowed to manage.

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
