from sentry.api.helpers.teams import get_teams
from sentry.incidents.models.alert_rule import AlertRuleThresholdType


def parse_team_params(request, organization, teams):
    teams_set = set(teams)

    unassigned = False
    if "unassigned" in teams_set:
        teams_set.remove("unassigned")
        unassigned = True

    teams = get_teams(request, organization, teams=teams_set)

    return (teams, unassigned)


threshold_translators = {
    AlertRuleThresholdType.ABOVE: lambda threshold: threshold - 100,
    AlertRuleThresholdType.BELOW: lambda threshold: 100 - threshold,
}


def translate_threshold(
    comparison_delta: int, threshold_type: AlertRuleThresholdType, threshold: float | None
):
    """
    Translates our internal percent representation into a delta percentage.
    For ABOVE: A percentage like 170% would become 70% increase
    For BELOW: A percentage like 40% would become 60% decrease.
    """
    if comparison_delta is None or threshold is None:
        return threshold

    threshold_type = AlertRuleThresholdType(threshold_type)
    return threshold_translators[threshold_type](threshold)
