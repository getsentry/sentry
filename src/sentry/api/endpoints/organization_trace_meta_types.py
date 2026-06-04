from typing import NotRequired, TypedDict

from sentry.search.events.types import SnubaData


class OrganizationTraceMetaResponseOptional(TypedDict):
    uptimeCount: NotRequired[int]


class OrganizationTraceMetaResponse(OrganizationTraceMetaResponseOptional):
    errorsCount: int
    logsCount: float
    metricsCount: float
    performanceIssuesCount: int
    spansCount: float
    transactionChildCountMap: SnubaData
    spansCountMap: dict[str, float]
