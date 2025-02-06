from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery

QUERY_TYPE_VALID_DATASETS = {
    SnubaQuery.Type.ERROR: {Dataset.Events},
    SnubaQuery.Type.PERFORMANCE: {
        Dataset.Transactions,
        Dataset.PerformanceMetrics,
        Dataset.EventsAnalyticsPlatform,
    },
    SnubaQuery.Type.CRASH_RATE: {Dataset.Metrics},
}

# TODO(davidenwang): eventually we should pass some form of these to the event_search parser to raise an error
UNSUPPORTED_QUERIES = {"release:latest"}

# Allowed time windows (in minutes) for crash rate alerts
CRASH_RATE_ALERTS_ALLOWED_TIME_WINDOWS = [30, 60, 120, 240, 720, 1440]
