from sentry.incidents.models.alert_rule import AlertRule, AlertRuleStatus
from sentry.models.project import Project
from sentry.seer.anomaly_detection.types import AnomalyType


def get_historical_anomaly_data_from_seer(
    alert_rule: AlertRule, project: Project, start_string: str, end_string: str
) -> list | None:
    """
    Send time series data to Seer and return anomaly detection response (PLACEHOLDER).
    """
    if alert_rule.status == AlertRuleStatus.NOT_ENOUGH_DATA.value:
        return []

    return [
        {
            "timestamp": 0.1,
            "value": 100.0,
            "anomaly": {
                "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
                "anomaly_value": 100,
            },
        }
    ]
