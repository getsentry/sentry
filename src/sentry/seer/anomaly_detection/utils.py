from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.seer.anomaly_detection.types import TimeSeriesPoint
from sentry.utils.snuba import SnubaTSResult


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


def format_historical_data(data: SnubaTSResult) -> list[TimeSeriesPoint]:
    """
    Format Snuba data into the format the Seer API expects.
    If there are no results, it's just the timestamp
    {'time': 1719012000}, {'time': 1719018000}, {'time': 1719024000}

    If there are results, the count is added
    {'time': 1721300400, 'count': 2}
    """
    formatted_data = []
    for datum in data.data.get("data", []):
        ts_point = TimeSeriesPoint(timestamp=datum.get("time"), value=datum.get("count", 0))
        formatted_data.append(ts_point)
    return formatted_data
