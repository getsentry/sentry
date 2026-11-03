from typing import Any, Literal, NotRequired, TypedDict

from sentry.incidents.typings.query_subscription import QuerySubscriptionSerializerResponse
from sentry.issues.issue_occurrence import BaseIssueOccurrenceResponse

# These mirror `MetricIssueEvidenceData` as the API returns it: `EventSerializer` camelCases every
# key of the stored snake_case evidence data.


class MetricIssueAnomalyDetectionValueResponse(TypedDict):
    value: float
    sourceId: str
    subscriptionId: str
    timestamp: str


class MetricIssueConditionResponse(TypedDict):
    id: int
    type: str
    comparison: float | dict[str, Any]
    conditionResult: int


class MetricIssueDetectorConfigResponse(TypedDict):
    detectionType: Literal["static", "percent", "dynamic"]
    comparisonDelta: NotRequired[int | None]


class MetricIssueDataSourceResponse(TypedDict):
    id: str
    organizationId: str
    type: str
    sourceId: str
    queryObj: QuerySubscriptionSerializerResponse


class MetricIssueEvidenceDataResponse(TypedDict):
    detectorId: int
    alertId: int | None
    value: float | MetricIssueAnomalyDetectionValueResponse | None
    dataPacketSourceId: str
    conditions: list[MetricIssueConditionResponse]
    config: MetricIssueDetectorConfigResponse
    dataSources: list[MetricIssueDataSourceResponse]


class MetricIssueOccurrenceResponse(BaseIssueOccurrenceResponse):
    """A metric issue occurrence. `evidenceData` describes the detector and query that fired."""

    type: Literal[8001]
    evidenceData: MetricIssueEvidenceDataResponse
