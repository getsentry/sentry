from datetime import timedelta

from sentry import options
from sentry.utils import metrics

# TTL in milliseconds for values persisted by the dynamic sampling tasks.
DEFAULT_REDIS_CACHE_KEY_TTL = 24 * 60 * 60 * 1000  # 24 hours

ADJUSTED_FACTOR_TTL_MINUTES_OPTION = "dynamic-sampling.recalibration.factor-ttl-minutes"


def adjusted_factor_ttl_ms() -> int:
    return int(options.get(ADJUSTED_FACTOR_TTL_MINUTES_OPTION)) * 60 * 1000


# Parameters to bound the queries run in Snuba.
MAX_ORGS_PER_QUERY = 80
MAX_PROJECTS_PER_QUERY = 4000
MAX_TRANSACTIONS_PER_PROJECT = 20

# MIN and MAX rebalance factor in order to make sure we don't go crazy when rebalancing orgs.
MIN_REBALANCE_FACTOR = 0.1
MAX_REBALANCE_FACTOR = 10

CLAMP_REBALANCE_FACTOR_OPTION = "dynamic-sampling.recalibration.clamp-factor"


def bounded_rebalance_factor(factor: float) -> float | None:
    """The factor bounded to [MIN_REBALANCE_FACTOR, MAX_REBALANCE_FACTOR].

    An out-of-range factor is clamped to the nearest bound when the clamp option
    is on, and discarded (None) otherwise. A discarded factor tells the caller
    to delete the stored factor.
    """
    if MIN_REBALANCE_FACTOR <= factor <= MAX_REBALANCE_FACTOR:
        return factor
    if options.get(CLAMP_REBALANCE_FACTOR_OPTION):
        metrics.incr("dynamic_sampling.recalibration.factor_clamped")
        return min(max(factor, MIN_REBALANCE_FACTOR), MAX_REBALANCE_FACTOR)
    return None


# Snuba's limit is 10000, and we fetch CHUNK_SIZE + 1.
CHUNK_SIZE = 9998

# Time interval of queries for boost low volume transactions.
BOOST_LOW_VOLUME_TRANSACTIONS_QUERY_INTERVAL = timedelta(hours=1)
