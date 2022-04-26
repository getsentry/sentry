from __future__ import annotations

from typing import Collection

from django.db import transaction
from rest_framework.request import Request

from sentry import roles
from sentry.auth.superuser import is_active_superuser
from sentry.models import Organization, OrganizationMember, OrganizationMemberTeam
from sentry.roles.manager import Role


@transaction.atomic
def save_team_assignments(organization_member, teams):
    # teams may be empty
    OrganizationMemberTeam.objects.filter(organizationmember=organization_member).delete()
    OrganizationMemberTeam.objects.bulk_create(
        [
            OrganizationMemberTeam(team=team, organizationmember=organization_member)
            for team in teams
        ]
    )


def get_allowed_roles(
    request: Request,
    organization: Organization,
    member: OrganizationMember | None = None,
) -> Collection[Role]:
    """Get the set of roles that the request is allowed to manage.

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
            return _get_allowed_roles_by_access(request)

    return member.get_allowed_roles_to_invite()


def _get_allowed_roles_by_access(request: Request) -> Collection[Role]:
    """Infer allowed roles by the request's total set of scopes.

    For use when the request was authorized by a token (such as from an app
    integration) that doesn't correspond to a user's organization membership,
    which means we can't compare to a member's role. Allow such a token to assign a
    role if the token has access to all of that role's scopes.
    """
    return [role for role in roles.get_all() if role.scopes.issubset(request.access.scopes)]


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
    "get_allowed_roles",
    "save_team_assignments",
)
