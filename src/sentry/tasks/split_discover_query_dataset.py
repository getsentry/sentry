import logging
from time import time

import sentry_sdk
from cachetools import LRUCache
from celery.exceptions import SoftTimeLimitExceeded

from sentry import options
from sentry.discover.dataset_split import (
    get_and_save_split_decision_for_query,
    save_split_decision_for_query,
)
from sentry.discover.models import DatasetSourcesTypes, DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics, snuba
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.split_discover_query_dataset")


@instrumented_task(
    name="sentry.tasks.split_discover_query_dataset",
    queue="split_discover_query_dataset",
    max_retries=None,
    soft_time_limit=4 * 60 * 60,  # 4 hours
    time_limit=4 * 60 * 60 + 5,
)
def split_discover_query_dataset(dry_run: bool, **kwargs):
    # Kill switch, this task is okay to kill
    if not options.get("discover.saved-query-dataset-split.enable"):
        return

    organization_allowlist = options.get(
        "discover.saved-query-dataset-split.organization-allowlist"
    )

    rate_limit_cache = LRUCache(maxsize=1000)

    total_processed = 0
    transaction_dataset_count = 0
    error_dataset_count = 0
    errored_query_count = 0

    inferred_without_query = 0
    inferred_with_query = 0

    last_activity = int(time())

    while True:
        if int(time()) - last_activity > 60:
            logger.warning(
                "sentry.tasks.split_discover_query_dataset - forced exit",
                extra={
                    "total_processed": total_processed,
                    "transaction_dataset_count": transaction_dataset_count,
                    "error_dataset_count": error_dataset_count,
                    "errored_query_count": errored_query_count,
                    "inferred_with_query": inferred_with_query,
                    "inferred_without_query": inferred_without_query,
                },
            )
            break

        queryset = DiscoverSavedQuery.objects.filter(
            organization_id__in=organization_allowlist,
            dataset=DiscoverSavedQueryTypes.DISCOVER,
            dataset_source=DatasetSourcesTypes.UNKNOWN,
        )
        if not queryset:
            logger.info(
                "sentry.tasks.split_discover_query_dataset - exit",
                extra={
                    "total_processed": total_processed,
                    "transaction_dataset_count": transaction_dataset_count,
                    "error_dataset_count": error_dataset_count,
                    "errored_query_count": errored_query_count,
                    "inferred_with_query": inferred_with_query,
                    "inferred_without_query": inferred_without_query,
                },
            )
            break

        for saved_query in RangeQuerySetWrapper(queryset):
            last_accessed = rate_limit_cache.get(saved_query.organization_id, None)
            # Don't try to split if we've run hit snuba for this org in the last 10 seconds
            if last_accessed is not None and int(time()) - last_accessed < 10:
                continue

            total_processed += 1
            try:
                with metrics.timer("sentry.tasks.split_discover_query_dataset.save_split_decision"):
                    split_decision, queried_snuba = get_and_save_split_decision_for_query(
                        saved_query, dry_run=dry_run
                    )
                    if split_decision == DiscoverSavedQueryTypes.ERROR_EVENTS:
                        error_dataset_count += 1
                    else:
                        transaction_dataset_count += 1

                    if queried_snuba:
                        inferred_with_query += 1
                        rate_limit_cache[saved_query.organization_id] = int(time())
                    else:
                        inferred_without_query += 1

                last_activity = int(time())

            except (
                snuba.RateLimitExceeded,
                snuba.QueryConnectionFailed,
                snuba.QueryTooManySimultaneous,
            ) as e:
                # These are errors that should be okay to be retried on the next batch, so not setting
                # a DatasetSourcesTypes.SPLIT_ERRORED dataset_source.
                sentry_sdk.capture_exception(
                    e,
                    contexts={
                        "discover_saved_query_id": saved_query.id,
                        "organization_id": saved_query.organization.id,
                    },
                )
                inferred_with_query += 1
                rate_limit_cache[saved_query.organization_id] = int(time()) + 300
                errored_query_count += 1
                last_activity = int(time())

            except snuba.SnubaError as e:
                sentry_sdk.capture_exception(
                    e,
                    contexts={
                        "discover_saved_query_id": saved_query.id,
                        "organization_id": saved_query.organization.id,
                    },
                )
                errored_query_count += 1
                inferred_with_query += 1
                if not dry_run:
                    save_split_decision_for_query(
                        saved_query,
                        None,
                        DatasetSourcesTypes.SPLIT_ERRORED.value,
                    )
                last_activity = int(time())

            except SoftTimeLimitExceeded:
                errored_query_count += 1
                logger.warning(
                    "SoftTimeLimitExceeded",
                    extra={
                        "total_processed": total_processed,
                        "transaction_dataset_count": transaction_dataset_count,
                        "error_dataset_count": error_dataset_count,
                        "errored_query_count": errored_query_count,
                        "inferred_with_query": inferred_with_query,
                        "inferred_without_query": inferred_without_query,
                    },
                )

            except Exception as e:
                errored_query_count += 1
                sentry_sdk.capture_exception(
                    e,
                    contexts={
                        "discover_saved_query_id": saved_query.id,
                        "organization_id": saved_query.organization.id,
                    },
                )
