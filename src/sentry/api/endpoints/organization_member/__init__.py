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
    if is_active_superuser(request):
        return roles.get_all()
    if not request.access.has_scope("member:admin"):
        return ()

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
            return ()

    if member and roles.get(acting_member.role).priority < roles.get(member.role).priority:
        # Disallow the acting member from demoting another member who outranks them
        return ()

    return acting_member.get_allowed_roles_to_invite()


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
