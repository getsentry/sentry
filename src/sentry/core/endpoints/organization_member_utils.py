from __future__ import annotations

import logging
from collections.abc import Collection

from django.db import router, transaction
from rest_framework import serializers
from rest_framework.request import Request

from sentry import roles
from sentry.api.bases.organization import OrganizationPermission
from sentry.auth.access import Access
from sentry.auth.superuser import is_active_superuser, superuser_has_permission
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.roles.manager import Role, TeamRole
from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger("sentry.org_roles")

ERR_RATE_LIMITED = "You are being rate limited for too many invitations."

# Required to explicitly define roles w/ descriptions because OrganizationMemberSerializer
# has the wrong descriptions, includes deprecated admin, and excludes billing
ROLE_CHOICES = [
    ("billing", "Can manage payment and compliance details."),
    (
        "member",
        "Can view and act on events, as well as view most other data within the organization.",
    ),
    (
        "manager",
        """Has full management access to all teams and projects. Can also manage
        the organization's membership.""",
    ),
    (
        "owner",
        """Has unrestricted access to the organization, its data, and its
        settings. Can add, modify, and delete projects and members, as well as
        make billing and plan changes.""",
    ),
    (
        "admin",
        """Can edit global integrations, manage projects, and add/remove teams.
        They automatically assume the Team Admin role for teams they join.
        Note: This role can no longer be assigned in Business and Enterprise plans. Use `TeamRoles` instead.
        """,
    ),
]


class MemberConflictValidationError(serializers.ValidationError):
    pass


class RelaxedMemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "POST": ["member:write", "member:admin"],
        "PUT": ["member:invite", "member:write", "member:admin"],
        # DELETE checks for role comparison as you can either remove a member
        # with a lower access role, or yourself, without having the req. scope
        "DELETE": ["member:read", "member:write", "member:admin"],
    }

    # Allow deletions to happen for disabled members so they can remove themselves
    # allowing other methods should be fine as well even if we don't strictly need to allow them
    def is_member_disabled_from_limit(
        self,
        request: Request,
        organization: RpcUserOrganizationContext | RpcOrganization | Organization | int,
    ) -> bool:
        return False


class TeamAssignmentChange:
    def __init__(self, team: Team, omt_id: int) -> None:
        self.team = team
        self.omt_id = omt_id


class TeamAssignmentDiff:
    def __init__(
        self, added: list[TeamAssignmentChange], removed: list[TeamAssignmentChange]
    ) -> None:
        self.added = added
        self.removed = removed


def save_team_assignments(
    organization_member: OrganizationMember,
    teams: list[Team] | None,
    teams_with_roles: list[tuple[Team, str]] | None = None,
) -> TeamAssignmentDiff:
    # https://github.com/getsentry/sentry/pull/6054/files/8edbdb181cf898146eda76d46523a21d69ab0ec7#r145798271
    lock = locks.get(
        f"org:member:{organization_member.id}", duration=5, name="save_team_assignment"
    )
    with TimedRetryPolicy(10)(lock.acquire):
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

        with transaction.atomic(router.db_for_write(OrganizationMemberTeam)):
            existing = OrganizationMemberTeam.objects.filter(organizationmember=organization_member)
            old_omt_by_team = {omt.team_id: omt for omt in existing}
            old_team_ids = set(old_omt_by_team.keys())
            new_team_ids = {team.id for team in target_teams}

            removed_ids = old_team_ids - new_team_ids
            teams_by_id = {team.id: team for team in target_teams}
            removed_teams = list(Team.objects.filter(id__in=removed_ids)) if removed_ids else []
            removed_changes = [
                TeamAssignmentChange(team=t, omt_id=old_omt_by_team[t.id].id) for t in removed_teams
            ]

            OrganizationMemberTeam.objects.bulk_delete(existing)
            OrganizationMemberTeam.objects.bulk_create(
                [
                    OrganizationMemberTeam(
                        organizationmember=organization_member, team=team, role=role
                    )
                    for team, role in new_assignments
                ]
            )

        added_ids = new_team_ids - old_team_ids
        new_omts = OrganizationMemberTeam.objects.filter(
            organizationmember=organization_member, team_id__in=added_ids
        )
        new_omt_by_team = {omt.team_id: omt for omt in new_omts}
        added_changes = [
            TeamAssignmentChange(team=teams_by_id[tid], omt_id=new_omt_by_team[tid].id)
            for tid in added_ids
            if tid in teams_by_id and tid in new_omt_by_team
        ]
        return TeamAssignmentDiff(added=added_changes, removed=removed_changes)


def can_set_team_role(request: Request, team: Team, new_role: TeamRole) -> bool:
    """
    User can set a team role:

    * If they are an active superuser (with the feature flag, they must be superuser write)
    * If they are an org owner/manager/admin
    * If they are a team admin on the team
    """
    if superuser_has_permission(request):
        return True

    access: Access = request.access
    if can_admin_team(access, team):
        return True

    org_role = access.get_organization_role()
    if org_role and org_role.can_manage_team_role(new_role):
        return True

    team_role = access.get_team_role(team)
    if team_role and team_role.can_manage(new_role):
        return True

    return False


def can_admin_team(access: Access, team: Team) -> bool:
    return access.has_team_membership(team) and (
        access.has_team_scope(team, "team:write")
        or access.has_scope("org:write")
        or access.has_scope("member:write")
    )


def get_allowed_org_roles(
    request: Request,
    organization: Organization,
    member: OrganizationMember | None = None,
    creating_org_invite: bool = False,
) -> Collection[Role]:
    """
    Get the set of org-level roles that the request is allowed to manage.

    In order to change another member's role, the returned set must include both
    the starting role and the new role. That is, the set contains the roles that
    the request is allowed to promote someone to and to demote someone from.

    If the request is to invite a new member, the member:admin scope is not required.
    """

    if is_active_superuser(request):
        return roles.get_all()

    # The member:admin scope is not required to invite a new member (when creating_org_invite is True).
    if not request.access.has_scope("member:admin") and not creating_org_invite:
        return ()

    if member is None:
        try:
            member = OrganizationMember.objects.get(
                user_id=request.user.id, organization=organization
            )
        except OrganizationMember.DoesNotExist:
            # This can happen if the request was authorized by an app integration
            # token whose proxy user does not have an OrganizationMember object.
            return ()

    return member.get_allowed_org_roles_to_invite()
