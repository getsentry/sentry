from typing import int
class InvalidMetricsQueryError(Exception):
    pass


class MetricsQueryExecutionError(Exception):
    pass


class LatestReleaseNotFoundError(Exception):
    pass
