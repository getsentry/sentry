from sentry.ingest.transaction_clusterer.datasource.redis import record_transaction_name
from sentry.signals import transaction_processed

transaction_processed.connect(record_transaction_name, weak=False)
