import logging
from typing import Any

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
from sentry.workflow_engine.types import DetectorException, DetectorPriorityLevel

logger = logging.getLogger(__name__)

seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)


def _fetch_related_models(
    detector: Detector, method: str
) -> tuple[DataSource, DataCondition, SnubaQuery]:
    # XXX: it is technically possible (though not used today) that a detector could have multiple data sources
    data_source_detector = DataSourceDetector.objects.filter(detector_id=detector.id).first()
    if not data_source_detector:
        raise DetectorException(f"Could not {method} detector, data source not found.")
    data_source = data_source_detector.data_source

    try:
        query_subscription = QuerySubscription.objects.get(id=int(data_source.source_id))
    except QuerySubscription.DoesNotExist:
        raise DetectorException(
            f"Could not {method} detector, query subscription {data_source.source_id} not found."
        )
    try:
        snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query_id)
    except SnubaQuery.DoesNotExist:
        raise DetectorException(
            f"Could not {method} detector, snuba query {query_subscription.snuba_query_id} not found."
        )
    try:
        data_condition = DataCondition.objects.get(
            condition_group=detector.workflow_condition_group,
            condition_result__in=[
                DetectorPriorityLevel.HIGH,
                DetectorPriorityLevel.MEDIUM,
            ],
        )
    except (DataCondition.DoesNotExist, DataCondition.MultipleObjectsReturned):
        # there should only ever be one non-resolution data condition for a dynamic metric detector, we dont actually expect a MultipleObjectsReturned
        dcg_id = (
            detector.workflow_condition_group.id
            if detector.workflow_condition_group is not None
            else None
        )
        raise DetectorException(
            f"Could not {method} detector, data condition {dcg_id} not found or too many found."
        )
    return data_source, data_condition, snuba_query


def update_detector_data(
    detector: Detector,
    updated_fields: dict[str, Any],
) -> None:
    data_source, data_condition, snuba_query = _fetch_related_models(detector, "update")

    # use setattr to avoid saving the models until the Seer call has successfully finished,
    # otherwise they would be in a bad state
    updated_data_condition_data = updated_fields.get("condition_group", {}).get("conditions")
    if updated_data_condition_data:
        for k, v in updated_data_condition_data[0].items():
            setattr(data_condition, k, v)

    event_types = snuba_query.event_types
    updated_data_source_data = updated_fields.get("data_sources")
    if updated_data_source_data:
        data_source_data = updated_data_source_data[0]
        event_types = data_source_data.get("event_types")

        for k, v in data_source_data.items():
            if k == "dataset":
                v = v.value
            elif k == "time_window":
                time_window = data_source_data.get("time_window")
                v = time_window if time_window is not None else snuba_query.time_window
            elif k == "event_types":
                continue
            setattr(snuba_query, k, v)

    try:
        handle_send_historical_data_to_seer(
            detector,
            data_source,
            data_condition,
            snuba_query,
            detector.project,
            SeerMethod.UPDATE,
            event_types,
        )
    except TimeoutError:
        raise ValidationError("Timed out sending data to Seer, unable to update detector")
    except MaxRetryError:
        raise ValidationError("Hit max retries sending data to Seer, unable to update detector")
    except ParseError:
        raise ValidationError("Couldn't parse response from Seer, unable to update detector")
    except ValidationError:
        raise ValidationError("Hit validation error, unable to update detector")
    metrics.incr("anomaly_detection_monitor.updated")


def send_new_detector_data(detector: Detector) -> None:
    """
    Send historical data for a new Detector to Seer.
    """
    data_source, data_condition, snuba_query = _fetch_related_models(detector, "create")

    try:
        handle_send_historical_data_to_seer(
            detector, data_source, data_condition, snuba_query, detector.project, SeerMethod.CREATE
        )
    except (TimeoutError, MaxRetryError, ParseError, ValidationError):
        raise ValidationError("Couldn't send data to Seer, unable to create detector")
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
        id=None,
        source_id=int(data_source.source_id),
        source_type=DataSourceType.SNUBA_QUERY_SUBSCRIPTION,
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
        status_code_error_string = "Error when hitting Seer store data endpoint"
        logger.error(
            status_code_error_string,
            extra={
                "ad_config": anomaly_detection_config,
                "detector": detector.id,
                "response_data": response.data,
                "response_code": response.status,
            },
        )
        raise Exception(status_code_error_string)

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
            "Error when hitting Seer store data endpoint: %s",
            message,
            extra={
                "detector_id": detector.id,
                "project_id": project.id,
                "error_message": message,
            },
        )
        raise Exception(message)
    return None
