from datetime import timedelta

# Parameters to bound the queries run in Snuba.
MAX_ORGS_PER_QUERY = 80
MAX_PROJECTS_PER_QUERY = 4000
MAX_TRANSACTIONS_PER_PROJECT = 20

# Snuba's limit is 10000, and we fetch CHUNK_SIZE + 1.
CHUNK_SIZE = 9998

# Time interval of queries for boost low volume transactions.
BOOST_LOW_VOLUME_TRANSACTIONS_QUERY_INTERVAL = timedelta(hours=1)
