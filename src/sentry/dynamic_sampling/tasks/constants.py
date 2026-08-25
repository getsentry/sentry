from datetime import timedelta

from sentry import options

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

# Parameters to bound the execution time of queries in Snuba.
MAX_SECONDS = 60

# The maximum time a dynamic sampling task can run.
MAX_TASK_SECONDS = 7 * 60  # 7 minutes

# Snuba's limit is 10000, and we fetch CHUNK_SIZE + 1.
CHUNK_SIZE = 9998

# Time interval of queries for boost low volume transactions.
BOOST_LOW_VOLUME_TRANSACTIONS_QUERY_INTERVAL = timedelta(hours=1)
