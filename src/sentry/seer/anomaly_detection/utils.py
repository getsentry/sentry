from sentry.incidents.models.alert_rule import AlertRuleThresholdType


def translate_direction(direction: int) -> str:
    """
    Temporary translation map to Seer's expected values
    """
    direction_map = {
        AlertRuleThresholdType.ABOVE: "up",
        AlertRuleThresholdType.BELOW: "down",
        AlertRuleThresholdType.ABOVE_AND_BELOW: "both",
    }
    return direction_map[AlertRuleThresholdType(direction)]
