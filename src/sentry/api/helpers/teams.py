from sentry.api.utils import InvalidParams
from sentry.auth.superuser import is_active_superuser
from sentry.models import Team, TeamStatus


def get_teams(request, organization, teams=None):
    # do normal teams lookup based on request params
    requested_teams = set(request.GET.getlist("team", [])) if teams is None else teams

    verified_ids = set()

    if "myteams" in requested_teams:
        requested_teams.remove("myteams")
        if is_active_superuser(request):
            # retrieve all teams within the organization
            myteams = Team.objects.filter(
                organization=organization, status=TeamStatus.VISIBLE
            ).values_list("id", flat=True)
            verified_ids.update(myteams)
        else:
            myteams = [t.id for t in request.access.teams]
            verified_ids.update(myteams)

    for team_id in requested_teams:  # Verify each passed Team id is numeric
        if type(team_id) is not int and not team_id.isdigit():
            raise InvalidParams(f"Invalid Team ID: {team_id}")
    requested_teams.update(verified_ids)

    teams_query = Team.objects.filter(id__in=requested_teams)
    for team in teams_query:
        if team.id in verified_ids:
            continue

        if not request.access.has_team_access(team):
            raise InvalidParams(
                f"Error: You do not have permission to access {team.name}",
            )

    return teams_query
