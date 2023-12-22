from typing import Optional

from rest_framework.exceptions import PermissionDenied

from sentry.auth.superuser import is_active_superuser
from sentry.exceptions import InvalidParams
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team, TeamStatus


def is_team_admin(org_member: OrganizationMember, team: Optional[Team] = None) -> bool:
    """
    Defaults to returning true is the member is a team admin in the
    organization. Can also be scoped to a specific team.
    """
    omt = OrganizationMemberTeam.objects.filter(organizationmember=org_member, role="admin")
    if team:
        omt = omt.filter(team=team)
    return omt.exists()


def get_teams(request, organization, teams=None):
    # do normal teams lookup based on request params
    requested_teams = set(request.GET.getlist("team", [])) if teams is None else teams

    verified_ids = set()

    if "myteams" in requested_teams:
        requested_teams.remove("myteams")
        if is_active_superuser(request):
            # retrieve all teams within the organization
            myteams = Team.objects.filter(
                organization=organization, status=TeamStatus.ACTIVE
            ).values_list("id", flat=True)
            verified_ids.update(myteams)
        else:
            myteams = request.access.team_ids_with_membership
            verified_ids.update(myteams)

    for team_id in requested_teams:  # Verify each passed Team id is numeric
        if not isinstance(team_id, int) and not team_id.isdigit():
            raise InvalidParams(f"Invalid Team ID: {team_id}")
    requested_teams.update(verified_ids)

    teams_query = Team.objects.filter(id__in=requested_teams)
    for team in teams_query:
        if team.id in verified_ids:
            continue

        if not request.access.has_team_access(team):
            raise PermissionDenied(
                f"Error: You do not have permission to access {team.name}",
            )

    return teams_query
