from typing import Literal, TypedDict

from sentry.models.project import Project

WebVitalIssueDetectionType = Literal["lcp", "fcp", "cls", "ttfb", "inp"]
WebVitalIssueDetectionGroupingType = Literal["rendering", "cls", "inp"]


class WebVitalIssueGroupData(TypedDict):
    transaction: str
    project: Project
    vital_grouping: WebVitalIssueDetectionGroupingType
    scores: dict[WebVitalIssueDetectionType, float]
    values: dict[WebVitalIssueDetectionType, float]
