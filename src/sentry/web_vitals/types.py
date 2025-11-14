from typing import Literal, TypedDict, int

from sentry.models.project import Project

WebVitalIssueDetectionType = Literal["lcp", "fcp", "cls", "ttfb", "inp"]


class WebVitalIssueGroupData(TypedDict):
    transaction: str
    vital: WebVitalIssueDetectionType
    score: float
    project: Project
    value: float
