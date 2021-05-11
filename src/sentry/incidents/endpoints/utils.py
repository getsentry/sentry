from sentry.api.utils import InvalidParams
from sentry.auth.superuser import is_active_superuser
from sentry.models import Team, TeamStatus


def parse_team_params(request, organization, teams):
    teams_set = set(teams)
    # do normal teams lookup based on request params
    verified_ids = set()
    unassigned = False
    if "unassigned" in teams_set:
        teams_set.remove("unassigned")
        unassigned = True

    if "myteams" in teams_set:
        teams_set.remove("myteams")
        if is_active_superuser(request):
            # retrieve all teams within the organization
            myteams = Team.objects.filter(
                organization=organization, status=TeamStatus.VISIBLE
            ).values_list("id", flat=True)
            verified_ids.update(myteams)
        else:
            myteams = [t.id for t in request.access.teams]
            verified_ids.update(myteams)

    for team_id in teams_set:  # Verify each passed Team id is numeric
        if type(team_id) is not int and not team_id.isdigit():
            raise InvalidParams(f"Invalid Team ID: {team_id}")
    teams_set.update(verified_ids)

    teams_query = Team.objects.filter(id__in=teams_set)
    for team in teams_query:
        if team.id in verified_ids:
            continue

        if not request.access.has_team_access(team):
            raise InvalidParams(
                f"Error: You do not have permission to access {team.name}",
            )

    return (teams_query, unassigned)
