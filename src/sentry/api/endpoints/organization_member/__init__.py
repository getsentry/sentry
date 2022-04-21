from __future__ import annotations

from typing import Iterable

from django.db import transaction
from rest_framework.request import Request

from sentry import roles
from sentry.auth import access
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
) -> tuple[bool, Iterable[Role]]:
    can_admin = request.access.has_scope("member:admin")

    allowed_roles = []
    if can_admin and not is_active_superuser(request):
        if member:
            acting_member = member
        else:
            try:
                acting_member = OrganizationMember.objects.get(
                    user=request.user, organization=organization
                )
            except OrganizationMember.DoesNotExist:
                # This can happen if the request was authorized by an app integration
                # token whose proxy user does not have an OrganizationMember object.
                return can_admin, _get_allowed_roles_by_access(request, organization)

        if member and roles.get(acting_member.role).priority < roles.get(member.role).priority:
            can_admin = False
        else:
            allowed_roles = acting_member.get_allowed_roles_to_invite()
            can_admin = bool(allowed_roles)
    elif is_active_superuser(request):
        allowed_roles = roles.get_all()

    return can_admin, allowed_roles


def _get_allowed_roles_by_access(request: Request, organization: Organization) -> Iterable[Role]:
    """Infer allowed roles by the request's total set of scopes.

    For use when the request was authorized by a token (such as from an app
    integration) that doesn't correspond to a user's organization membership,
    which means we can't compare to a member's role. Allow such a token to assign a
    role if the token has access to all of that role's scopes.
    """
    access_obj = access.from_request(request, organization)
    return [role for role in roles.get_all() if access_obj.scopes.issuperset(role.scopes)]


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
