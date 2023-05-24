from __future__ import annotations

from collections import defaultdict
from typing import Iterable, List, MutableMapping, Set, cast

from sentry.constants import ObjectStatus
from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    ProjectTeam,
    Team,
    TeamStatus,
)
from sentry.services.hybrid_cloud.organization import (
    RpcOrganization,
    RpcOrganizationFlags,
    RpcOrganizationMember,
    RpcOrganizationMemberFlags,
    RpcOrganizationMemberSummary,
    RpcOrganizationSummary,
    RpcProject,
    RpcTeam,
    RpcTeamMember,
)


def escape_flag_name(flag_name: str) -> str:
    return flag_name.replace(":", "__").replace("-", "_")


def unescape_flag_name(flag_name: str) -> str:
    return flag_name.replace("__", ":").replace("_", "-")


def _serialize_member_flags(member: OrganizationMember) -> RpcOrganizationMemberFlags:
    return cast(
        RpcOrganizationMemberFlags,
        RpcOrganizationMemberFlags.serialize_by_field_name(
            member.flags, name_transform=unescape_flag_name, value_transform=bool
        ),
    )


def serialize_member(member: OrganizationMember) -> RpcOrganizationMember:
    rpc_member = RpcOrganizationMember(
        id=member.id,
        organization_id=member.organization_id,
        user_id=member.user_id if member.user_id is not None else None,
        role=member.role,
        has_global_access=member.has_global_access,
        scopes=list(member.get_scopes()),
        flags=_serialize_member_flags(member),
        invite_status=member.invite_status,
        token=member.token or "",
        is_pending=member.is_pending,
        invite_approved=member.invite_approved,
        token_expired=member.token_expired,
        legacy_token=member.legacy_token,
        email=member.get_email(),
    )

    omts = OrganizationMemberTeam.objects.filter(
        organizationmember=member, is_active=True, team__status=TeamStatus.ACTIVE
    )

    all_project_ids: Set[int] = set()
    project_ids_by_team_id: MutableMapping[int, List[int]] = defaultdict(list)
    for pt in ProjectTeam.objects.filter(
        project__status=ObjectStatus.ACTIVE, team_id__in={omt.team_id for omt in omts}
    ):
        all_project_ids.add(pt.project_id)
        project_ids_by_team_id[pt.team_id].append(pt.project_id)

    for omt in omts:
        omt.organizationmember = member
        rpc_member.member_teams.append(
            _serialize_team_member(omt, project_ids_by_team_id[omt.team_id])
        )
    rpc_member.project_ids = list(all_project_ids)

    return rpc_member


def summarize_member(member: OrganizationMember) -> RpcOrganizationMemberSummary:
    return RpcOrganizationMemberSummary(
        id=member.id,
        organization_id=member.organization_id,
        user_id=member.user_id,
        flags=_serialize_member_flags(member),
    )


def _serialize_flags(org: Organization) -> RpcOrganizationFlags:
    return cast(
        RpcOrganizationFlags,
        RpcOrganizationFlags.serialize_by_field_name(org.flags, value_transform=bool),
    )


def _serialize_team(team: Team) -> RpcTeam:
    return RpcTeam(
        id=team.id,
        status=team.status,
        organization_id=team.organization_id,
        slug=team.slug,
        org_role=team.org_role,
    )


def _serialize_team_member(
    team_member: OrganizationMemberTeam, project_ids: Iterable[int]
) -> RpcTeamMember:
    result = RpcTeamMember(
        id=team_member.id,
        slug=team_member.team.slug,
        is_active=team_member.is_active,
        role_id=team_member.get_team_role().id,
        team_id=team_member.team_id,
        project_ids=list(project_ids),
        scopes=list(team_member.get_scopes()),
    )

    return result


def _serialize_project(project: Project) -> RpcProject:
    return RpcProject(
        id=project.id,
        slug=project.slug,
        name=project.name,
        organization_id=project.organization_id,
        status=project.status,
    )


def serialize_organization_summary(org: Organization) -> RpcOrganizationSummary:
    return RpcOrganizationSummary(
        slug=org.slug,
        id=org.id,
        name=org.name,
    )


def serialize_organization(org: Organization) -> RpcOrganization:
    rpc_org: RpcOrganization = RpcOrganization(
        slug=org.slug,
        id=org.id,
        flags=_serialize_flags(org),
        name=org.name,
        status=int(org.status),
        default_role=org.default_role,
    )

    projects: List[Project] = Project.objects.filter(organization=org)
    teams: List[Team] = Team.objects.filter(organization=org)
    rpc_org.projects.extend(_serialize_project(project) for project in projects)
    rpc_org.teams.extend(_serialize_team(team) for team in teams)
    return rpc_org
