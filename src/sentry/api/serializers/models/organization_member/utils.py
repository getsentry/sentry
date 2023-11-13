from collections import defaultdict
from typing import Any, Dict, List, Sequence, Tuple, TypeVar

from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team, TeamStatus

TeamData = TypeVar("TeamData")
DictOfMembers = Dict[Any, List[TeamData]]
MembersTeams = DictOfMembers[str]
MembersTeamRoles = DictOfMembers[Dict[str, str]]


def get_teams_by_organization_member_id(
    organization_members: Sequence[OrganizationMember],
) -> Tuple[MembersTeams, MembersTeamRoles]:
    """@returns a map of member id -> team_slug[]"""
    organization_member_tuples = list(
        OrganizationMemberTeam.objects.filter(
            team__status=TeamStatus.ACTIVE, organizationmember__in=organization_members
        ).values_list("organizationmember_id", "team_id", "role")
    )
    team_ids = {team_id for (_om_id, team_id, _role) in organization_member_tuples}
    teams = Team.objects.filter(id__in=team_ids)
    teams_by_id = {team.id: team for team in teams}

    result_teams = defaultdict(list)
    result_teams_with_roles = defaultdict(list)
    for member_id, team_id, role in organization_member_tuples:
        teamSlug = teams_by_id[team_id].slug
        result_teams[member_id].append(teamSlug)  # Deprecated
        result_teams_with_roles[member_id].append({"teamSlug": teamSlug, "role": role})
    return result_teams, result_teams_with_roles


def get_organization_id(organization_members: Sequence[OrganizationMember]) -> int:
    """Ensure all organization_members have the same organization ID and then return that ID."""
    organization_ids = {
        organization_member.organization_id for organization_member in organization_members
    }
    if len(organization_ids) != 1:
        raise Exception("Cannot determine organization")
    return int(organization_ids.pop())
