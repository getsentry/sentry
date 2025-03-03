import logging
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from parsimonious.exceptions import ParseError
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.api.bases.organization_events import get_query_columns
from sentry.conf.server import SEER_ANOMALY_DETECTION_STORE_DATA_URL
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleDetectionType, AlertRuleStatus
from sentry.models.project import Project
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import (
    AlertInSeer,
    AnomalyDetectionConfig,
    StoreDataRequest,
    StoreDataResponse,
    TimeSeriesPoint,
)
from sentry.seer.anomaly_detection.utils import (
    fetch_historical_data,
    format_historical_data,
    get_dataset_from_label,
    get_event_types,
    translate_direction,
)
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.utils import json, metrics
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)

seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)
MIN_DAYS = 7


class SeerMethod(StrEnum):
    CREATE = "create"
    UPDATE = "update"


def _get_start_index(data: list[TimeSeriesPoint]) -> int:
    """
    Helper to return the first data points that has an event count. We can assume that all
    subsequent data points without associated event counts have event counts of zero.
    Used to determine whether we have at least a week's worth of data.
    """
    for i, datum in enumerate(data):
        if datum.get("value", 0) != 0:
            return i
    return -1


def handle_send_historical_data_to_seer(
    alert_rule: AlertRule,
    snuba_query: SnubaQuery,
    project: Project,
    method: str,
    event_types: list[SnubaQueryEventType.EventType] | None = None,
):
    event_types_param = event_types or snuba_query.event_types
    try:
        rule_status = send_historical_data_to_seer(
            alert_rule=alert_rule,
            project=project,
            snuba_query=snuba_query,
            event_types=event_types_param,
        )
        if rule_status == AlertRuleStatus.NOT_ENOUGH_DATA:
            # if we don't have at least seven days worth of data, then the dynamic alert won't fire
            alert_rule.update(status=AlertRuleStatus.NOT_ENOUGH_DATA.value)
        elif (
            rule_status == AlertRuleStatus.PENDING and alert_rule.status != AlertRuleStatus.PENDING
        ):
            alert_rule.update(status=AlertRuleStatus.PENDING.value)
    except (TimeoutError, MaxRetryError):
        raise TimeoutError(f"Failed to send data to Seer - cannot {method} alert rule.")
    except ParseError:
        raise ParseError("Failed to parse Seer store data response")
    except (ValidationError, Exception):
        raise ValidationError(f"Failed to send data to Seer - cannot {method} alert rule.")


def send_new_rule_data(alert_rule: AlertRule, project: Project, snuba_query: SnubaQuery) -> None:
    try:
        handle_send_historical_data_to_seer(alert_rule, snuba_query, project, SeerMethod.CREATE)
    except (TimeoutError, MaxRetryError, ParseError, ValidationError):
        alert_rule.delete()
        raise
    else:
        metrics.incr("anomaly_detection_alert.created")


def update_rule_data(
    alert_rule: AlertRule,
    project: Project,
    snuba_query: SnubaQuery,
    updated_fields: dict[str, Any],
    updated_query_fields: dict[str, Any],
) -> None:
    # if the rule previously wasn't a dynamic type but it is now, we need to send Seer data for the first time
    # OR it's dynamic but the query or aggregate is changing so we need to update the data Seer has
    if updated_fields.get("detection_type") == AlertRuleDetectionType.DYNAMIC and (
        alert_rule.detection_type != AlertRuleDetectionType.DYNAMIC
        or updated_query_fields.get("query")
        or updated_query_fields.get("aggregate")
    ):
        # use setattr to avoid saving the rule until the Seer call has successfully finished,
        # otherwise the rule would be in a bad state
        for k, v in updated_fields.items():
            setattr(alert_rule, k, v)

        for k, v in updated_query_fields.items():
            if k == "dataset":
                v = v.value
            elif k == "time_window":
                time_window = updated_query_fields.get("time_window")
                v = (
                    int(time_window.total_seconds())
                    if time_window is not None
                    else snuba_query.time_window
                )
            elif k == "event_types":
                continue
            setattr(alert_rule.snuba_query, k, v)

        handle_send_historical_data_to_seer(
            alert_rule,
            alert_rule.snuba_query,
            project,
            SeerMethod.UPDATE,
            updated_query_fields.get("event_types"),
        )


def send_historical_data_to_seer(
    alert_rule: AlertRule,
    project: Project,
    snuba_query: SnubaQuery | None = None,
    event_types: list[SnubaQueryEventType.EventType] | None = None,
) -> AlertRuleStatus:
    """
    Get 28 days of historical data and pass it to Seer to be used for prediction anomalies on the alert.
    """
    if not snuba_query:
        snuba_query = SnubaQuery.objects.get(id=alert_rule.snuba_query_id)
    window_min = int(snuba_query.time_window / 60)
    dataset = get_dataset_from_label(snuba_query.dataset)
    query_columns = get_query_columns([snuba_query.aggregate], window_min)
    event_types = get_event_types(snuba_query, event_types)
    if not alert_rule.organization:
        raise ValidationError("Alert rule doesn't belong to an organization")

    historical_data = fetch_historical_data(
        organization=alert_rule.organization,
        snuba_query=snuba_query,
        query_columns=query_columns,
        project=project,
        event_types=event_types,
    )

    if not historical_data:
        raise ValidationError("No historical data available.")

    formatted_data = format_historical_data(
        data=historical_data,
        query_columns=query_columns,
        dataset=dataset,
        organization=project.organization,
    )
    if not formatted_data:
        raise ValidationError("Unable to get historical data for this alert.")

    if (
        not alert_rule.sensitivity
        or not alert_rule.seasonality
        or alert_rule.threshold_type is None
        or alert_rule.organization is None
    ):
        # this won't happen because we've already gone through the serializer, but mypy insists
        raise ValidationError("Missing expected configuration for a dynamic alert.")

    anomaly_detection_config = AnomalyDetectionConfig(
        time_period=window_min,
        sensitivity=alert_rule.sensitivity,
        direction=translate_direction(alert_rule.threshold_type),
        expected_seasonality=alert_rule.seasonality,
    )
    alert = AlertInSeer(id=alert_rule.id)
    body = StoreDataRequest(
        organization_id=alert_rule.organization.id,
        project_id=project.id,
        alert=alert,
        config=anomaly_detection_config,
        timeseries=formatted_data,
    )
    logger.info(
        "Sending data to Seer's store data endpoint",
        extra={
            "ad_config": anomaly_detection_config,
            "alert": alert_rule.id,
            "dataset": snuba_query.dataset,
            "aggregate": snuba_query.aggregate,
            "meta": json.dumps(historical_data.data.get("meta", {}).get("fields", {})),
        },
    )
    try:
        response = make_signed_seer_api_request(
            connection_pool=seer_anomaly_detection_connection_pool,
            path=SEER_ANOMALY_DETECTION_STORE_DATA_URL,
            body=json.dumps(body).encode("utf-8"),
        )
    # See SEER_ANOMALY_DETECTION_TIMEOUT in sentry.conf.server.py
    except (TimeoutError, MaxRetryError):
        logger.warning(
            "Timeout error when hitting Seer store data endpoint",
            extra={
                "rule_id": alert_rule.id,
                "project_id": project.id,
            },
        )
        raise TimeoutError

    if response.status > 400:
        logger.error(
            "Error when hitting Seer store data endpoint",
            extra={"response_code": response.status},
        )
        raise Exception("Error when hitting Seer store data endpoint")

    try:
        decoded_data = response.data.decode("utf-8")
    except AttributeError:
        data_format_error_string = "Seer store data response data is malformed"
        logger.exception(
            data_format_error_string,
            extra={
                "ad_config": anomaly_detection_config,
                "alert": alert_rule.id,
                "response_data": response.data,
                "response_code": response.status,
            },
        )
        raise AttributeError(data_format_error_string)

    try:
        results: StoreDataResponse = json.loads(decoded_data)
    except JSONDecodeError:
        parse_error_string = "Failed to parse Seer store data response"
        logger.exception(
            parse_error_string,
            extra={
                "ad_config": anomaly_detection_config,
                "alert": alert_rule.id,
                "response_data": response.data,
                "response_code": response.status,
                "dataset": snuba_query.dataset,
                "meta": json.dumps(historical_data.data.get("meta", {}).get("fields", {})),
            },
        )
        raise ParseError(parse_error_string)

    if not results.get("success"):
        message = results.get("message", "")
        logger.error(
            "Error when hitting Seer store data endpoint",
            extra={
                "rule_id": alert_rule.id,
                "project_id": project.id,
                "error_message": message,
            },
        )
        raise Exception(message)

    data_start_index = _get_start_index(formatted_data)
    if data_start_index == -1:
        return AlertRuleStatus.NOT_ENOUGH_DATA

    data_start_time = datetime.fromtimestamp(formatted_data[data_start_index]["timestamp"])
    data_end_time = datetime.fromtimestamp(formatted_data[-1]["timestamp"])
    if data_end_time - data_start_time < timedelta(days=MIN_DAYS):
        return AlertRuleStatus.NOT_ENOUGH_DATA
    return AlertRuleStatus.PENDING
