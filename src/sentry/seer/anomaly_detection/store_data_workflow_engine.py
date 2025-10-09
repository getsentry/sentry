import logging

import sentry_sdk
from django.conf import settings
from django.core.exceptions import ValidationError
from parsimonious.exceptions import ParseError
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.api.bases.organization_events import get_query_columns
from sentry.conf.server import SEER_ANOMALY_DETECTION_STORE_DATA_URL
from sentry.models.project import Project
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.store_data import SeerMethod
from sentry.seer.anomaly_detection.types import (
    AlertInSeer,
    AnomalyDetectionConfig,
    DataSourceType,
    StoreDataRequest,
    StoreDataResponse,
)
from sentry.seer.anomaly_detection.utils import (
    fetch_historical_data,
    format_historical_data,
    get_dataset_from_label_and_event_types,
    get_event_types,
    translate_direction,
)
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.utils import json, metrics
from sentry.utils.json import JSONDecodeError
from sentry.workflow_engine.models import DataCondition, DataSource, DataSourceDetector, Detector

logger = logging.getLogger(__name__)

seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)


def send_new_detector_data(detector: Detector) -> None:
    try:
        data_source = DataSourceDetector.objects.get(detector_id=detector.id).data_source
    except DataSourceDetector.DoesNotExist:
        raise Exception("Could not create detector, data source detector not found.")
    try:
        query_subscription = QuerySubscription.objects.get(id=data_source.source_id)
    except QuerySubscription.DoesNotExist:
        raise Exception("Could not create detector, query subscription not found.")
    try:
        snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query_id)
    except SnubaQuery.DoesNotExist:
        raise Exception("Could not create detector, snuba query not found.")
    try:
        data_condition = DataCondition.objects.get(
            condition_group=detector.workflow_condition_group
        )
    except DataCondition.DoesNotExist:
        raise Exception("Could not create detector, data condition not found.")
    try:
        handle_send_historical_data_to_seer(
            detector, data_source, data_condition, snuba_query, detector.project, SeerMethod.CREATE
        )
    except (TimeoutError, MaxRetryError, ParseError, ValidationError):
        data_condition.delete()
        raise ValidationError("Couldn't send data to Seer, unable to create detector")
    else:
        metrics.incr("anomaly_detection_monitor.created")


def handle_send_historical_data_to_seer(
    detector: Detector,
    data_source: DataSource,
    data_condition: DataCondition,
    snuba_query: SnubaQuery,
    project: Project,
    method: str,
    event_types: list[SnubaQueryEventType.EventType] | None = None,
) -> None:
    event_types_param = event_types or snuba_query.event_types
    try:
        send_historical_data_to_seer(
            detector=detector,
            data_source=data_source,
            data_condition=data_condition,
            project=project,
            snuba_query=snuba_query,
            event_types=event_types_param,
        )
    except (TimeoutError, MaxRetryError):
        raise TimeoutError(f"Failed to send data to Seer - cannot {method} detector.")
    except ParseError:
        raise ParseError("Failed to parse Seer store data response")
    except ValidationError:
        raise ValidationError(f"Failed to send data to Seer - cannot {method} detector.")
    except Exception as e:
        sentry_sdk.capture_exception(e)
        raise ValidationError(f"Failed to send data to Seer - cannot {method} detector.")


def send_historical_data_to_seer(
    detector: Detector,
    data_source: DataSource,
    data_condition: DataCondition,
    project: Project,
    snuba_query: SnubaQuery,
    event_types: list[SnubaQueryEventType.EventType] | None = None,
) -> None:
    """
    Get 28 days of historical data and pass it to Seer to be used for prediction anomalies on the detector.
    """
    window_min = int(snuba_query.time_window / 60)
    event_types = get_event_types(snuba_query, event_types)
    dataset = get_dataset_from_label_and_event_types(snuba_query.dataset, event_types)
    query_columns = get_query_columns([snuba_query.aggregate], window_min)

    historical_data = fetch_historical_data(
        organization=project.organization,
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
        raise ValidationError("Unable to get historical data for this detector.")

    anomaly_detection_config = AnomalyDetectionConfig(
        time_period=window_min,
        sensitivity=data_condition.comparison.get("sensitivity"),
        direction=translate_direction(data_condition.comparison.get("threshold_type")),
        expected_seasonality=data_condition.comparison.get("seasonality"),
    )
    alert = AlertInSeer(
        id=None, source_id=data_source.id, source_type=DataSourceType.SNUBA_QUERY_SUBSCRIPTION
    )
    body = StoreDataRequest(
        organization_id=project.organization.id,
        project_id=project.id,
        alert=alert,
        config=anomaly_detection_config,
        timeseries=formatted_data,
    )
    logger.info(
        "Sending data to Seer's store data endpoint",
        extra={
            "ad_config": anomaly_detection_config,
            "detector": detector.id,
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
                "detector_id": detector.id,
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
                "detector": detector.id,
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
                "detector": detector.id,
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
                "detector_id": detector.id,
                "project_id": project.id,
                "error_message": message,
            },
        )
        raise Exception(message)
    return None
