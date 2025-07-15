from sentry.api.helpers.teams import get_teams
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleThresholdType
from sentry.workflow_engine.models.data_condition import Condition


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

data_condition_type_translators = {
    Condition.GREATER.value: lambda threshold: threshold - 100,
    Condition.LESS.value: lambda threshold: 100 - threshold,
}


def translate_threshold(alert_rule: AlertRule, threshold: float | None) -> float | None:
    """
    Translates our internal percent representation into a delta percentage.
    For ABOVE: A percentage like 170% would become 70% increase
    For BELOW: A percentage like 40% would become 60% decrease.
    """
    if alert_rule.comparison_delta is None or threshold is None:
        return threshold

    threshold_type = AlertRuleThresholdType(alert_rule.threshold_type)
    return threshold_translators[threshold_type](threshold)


def translate_data_condition_type(
    comparison_delta: int | None, condition_type: str, threshold: float | None
) -> float | None:
    """
    Translates our internal percent representation into a delta percentage.
    For ABOVE: A percentage like 170% would become 70% increase
    For BELOW: A percentage like 40% would become 60% decrease.
    """
    if comparison_delta is None or threshold is None:
        return threshold

    return data_condition_type_translators[condition_type](threshold)
