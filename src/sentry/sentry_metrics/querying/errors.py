class InvalidMetricsQueryError(Exception):
    pass


class MetricsQueryExecutionError(Exception):
    pass


class LatestReleaseNotFoundError(Exception):
    pass


class CorrelationsQueryExecutionError(Exception):
    pass


class NonNormalizableUnitsError(Exception):
    pass
