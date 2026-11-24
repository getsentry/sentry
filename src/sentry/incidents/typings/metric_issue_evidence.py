from typing import Annotated, Literal, NotRequired, TypedDict

from sentry.apidocs.descriptions import ApiDescription
from sentry.incidents.typings.query_subscription import QuerySubscriptionSerializerResponse
from sentry.issues.issue_occurrence import BaseIssueOccurrenceResponse
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
)

# These mirror `MetricIssueEvidenceData` as the API returns it: `EventSerializer` camelCases every
# key of the stored snake_case evidence data.


class MetricIssueAnomalyDetectionValueResponse(TypedDict):
    value: Annotated[float, ApiDescription("Metric value the anomaly detection model scored")]
    sourceId: Annotated[str, ApiDescription("ID of the data source that produced the value")]
    subscriptionId: Annotated[
        str, ApiDescription("ID of the query subscription that produced the value")
    ]
    timestamp: Annotated[str, ApiDescription("When the value was measured")]


# The comparison of an anomaly_detection condition, as AnomalyDetectionHandler's
# comparison_json_schema requires it.
class MetricIssueAnomalyDetectionComparisonResponse(TypedDict):
    sensitivity: Annotated[
        AnomalyDetectionSensitivity, ApiDescription("How sensitive the anomaly detection is")
    ]
    seasonality: Annotated[
        AnomalyDetectionSeasonality, ApiDescription("Seasonality the anomaly detection model uses")
    ]
    thresholdType: Annotated[
        AnomalyDetectionThresholdType,
        ApiDescription("Direction of anomalies to detect: 0 above, 1 below, 2 above and below"),
    ]


class MetricIssueConditionResponse(TypedDict):
    id: Annotated[int, ApiDescription("ID of the detector condition")]
    type: Annotated[
        str, ApiDescription("Type of the condition, such as gt, lt or anomaly_detection")
    ]
    comparison: Annotated[
        float | MetricIssueAnomalyDetectionComparisonResponse,
        ApiDescription(
            "Threshold the value is compared with, or the anomaly detection settings for an anomaly_detection condition"
        ),
    ]
    conditionResult: Annotated[
        int,
        ApiDescription(
            "Priority the detector reports when the condition matches: 0 ok, 25 low, 50 medium or 75 high"
        ),
    ]


class MetricIssueDetectorConfigResponse(TypedDict):
    detectionType: Annotated[
        Literal["static", "percent", "dynamic"],
        ApiDescription(
            "How the detector evaluates the metric: static thresholds, percent change or dynamic anomaly detection"
        ),
    ]
    comparisonDelta: NotRequired[
        Annotated[
            int | None,
            ApiDescription("Time window in seconds that a percent change detector compares with"),
        ]
    ]


class MetricIssueDataSourceResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the data source")]
    organizationId: Annotated[str, ApiDescription("ID of the organization")]
    type: Annotated[
        str, ApiDescription("Type of the data source, such as snuba_query_subscription")
    ]
    sourceId: Annotated[
        str, ApiDescription("ID of the source object, such as the query subscription")
    ]
    queryObj: Annotated[
        QuerySubscriptionSerializerResponse,
        ApiDescription("Query subscription the data source reads"),
    ]


class MetricIssueEvidenceDataResponse(TypedDict):
    detectorId: Annotated[int, ApiDescription("ID of the detector that created the occurrence")]
    alertId: Annotated[
        int | None,
        ApiDescription("ID of the metric alert rule the detector replaces. Null when there's none"),
    ]
    value: Annotated[
        float | MetricIssueAnomalyDetectionValueResponse | None,
        ApiDescription(
            "Metric value that triggered the detector, or the anomaly detection result for dynamic detectors"
        ),
    ]
    dataPacketSourceId: Annotated[
        str, ApiDescription("ID of the query subscription that sent the data")
    ]
    conditions: Annotated[
        list[MetricIssueConditionResponse], ApiDescription("Conditions of the detector")
    ]
    config: Annotated[
        MetricIssueDetectorConfigResponse, ApiDescription("Configuration of the detector")
    ]
    dataSources: Annotated[
        list[MetricIssueDataSourceResponse], ApiDescription("Data sources of the detector")
    ]


class MetricIssueOccurrenceResponse(BaseIssueOccurrenceResponse):
    """A metric issue occurrence. `evidenceData` describes the detector and query that fired."""

    type: Annotated[Literal[8001], ApiDescription("Group type ID of metric issues, always 8001")]
    evidenceData: Annotated[
        MetricIssueEvidenceDataResponse,
        ApiDescription("Detector and query that created the occurrence"),
    ]
