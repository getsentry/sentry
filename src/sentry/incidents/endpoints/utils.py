from sentry.api.helpers.teams import get_teams


def parse_team_params(request, organization, teams):
    teams_set = set(teams)

    unassigned = False
    if "unassigned" in teams_set:
        teams_set.remove("unassigned")
        unassigned = True

    teams = get_teams(request, organization, teams=teams_set)

    return (teams, unassigned)
