from typing import NotRequired, TypedDict

from sentry.search.events.types import SnubaData


class OrganizationTraceMetaResponse(TypedDict):
    uptimeCount: NotRequired[int]
    errorsCount: int
    logsCount: float
    metricsCount: float
    performanceIssuesCount: int
    spansCount: float
    transactionChildCountMap: SnubaData
    spansCountMap: dict[str, float]
