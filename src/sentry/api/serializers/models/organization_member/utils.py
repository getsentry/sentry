from collections import defaultdict
from typing import List, Mapping, Sequence, Set, Tuple

from sentry.api.serializers import serialize
from sentry.models import OrganizationMember, OrganizationMemberTeam, Team, TeamStatus, User


def get_serialized_users_by_id(users_set: Set[User], user: User) -> Mapping[str, User]:
    serialized_users = serialize(users_set, user)
    return {user["id"]: user for user in serialized_users}


def get_team_slugs_by_organization_member_id(
    organization_members: Sequence[OrganizationMember],
) -> Mapping[int, Tuple[List[str], List[object]]]:
    """@returns a map of member id -> team_slug[]"""
    organization_member_tuples = list(
        OrganizationMemberTeam.objects.filter(
            team__status=TeamStatus.VISIBLE, organizationmember__in=organization_members
        ).values_list("organizationmember_id", "team_id", "role")
    )
    team_ids = {team_id for (_om_id, team_id, _role) in organization_member_tuples}
    teams = Team.objects.filter(id__in=team_ids)
    teams_by_id = {team.id: team for team in teams}

    results = defaultdict(lambda: ([], []))
    for member_id, team_id, role in organization_member_tuples:
        teamSlug = teams_by_id[team_id].slug
        results[member_id][0].append(teamSlug)  # Deprecated
        results[member_id][1].append({"teamSlug": teamSlug, "role": role})
    return results


def get_organization_id(organization_members: Sequence[OrganizationMember]) -> int:
    """Ensure all organization_members have the same organization ID and then return that ID."""
    organization_ids = {
        organization_member.organization_id for organization_member in organization_members
    }
    if len(organization_ids) != 1:
        raise Exception("Cannot determine organization")
    return int(organization_ids.pop())
