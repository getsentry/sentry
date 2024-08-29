import logging
from collections.abc import MutableMapping
from time import sleep, time

import sentry_sdk
from celery.exceptions import SoftTimeLimitExceeded

from sentry import options
from sentry.discover.dataset_split import _get_and_save_split_decision_for_query
from sentry.discover.models import DatasetSourcesTypes, DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics, snuba
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.split_discover_query_dataset")


SLEEP_FOR = 5 * 60  # 5 minutes
MAX_NOOP_ATTEMPTS = 10
RATE_LIMIT_CACHE: MutableMapping[str | int, int] = {}


class NoOpException(Exception):
    pass


class EmptyQueryset(Exception):
    pass


class TaskKilled(Exception):
    pass


@sentry_sdk.trace
def _split_discover_query_dataset(dry_run):
    organization_allowlist = options.get(
        "discover.saved-query-dataset-split.organization-id-allowlist"
    )
    # Kill switch, this task is okay to kill
    if not options.get("discover.saved-query-dataset-split.enable"):
        raise TaskKilled

    # Tracks if any queries were processed this loop
    did_process = False

    transaction_dataset_count = 0
    error_dataset_count = 0
    errored_query_count = 0

    inferred_without_query = 0
    inferred_with_query = 0

    queryset = DiscoverSavedQuery.objects.filter(
        organization_id__in=organization_allowlist,
        dataset=DiscoverSavedQueryTypes.DISCOVER,
        dataset_source=DatasetSourcesTypes.UNKNOWN.value,
    ).select_related("organization")
    if not queryset:
        raise EmptyQueryset

    for saved_query in RangeQuerySetWrapper(queryset):
        # Kill switch, this task is okay to kill
        if not options.get("discover.saved-query-dataset-split.enable"):
            raise TaskKilled

        last_accessed = RATE_LIMIT_CACHE.get(saved_query.organization_id, None)
        # Don't try to split if we've run hit snuba for this org in the last 10 seconds
        if last_accessed is not None and int(time()) - last_accessed < 10:
            continue

        try:
            with metrics.timer("sentry.tasks.split_discover_query_dataset.save_split_decision"):
                split_decision, queried_snuba = _get_and_save_split_decision_for_query(
                    saved_query, dry_run=dry_run
                )
                if split_decision == DiscoverSavedQueryTypes.ERROR_EVENTS:
                    error_dataset_count += 1
                else:
                    transaction_dataset_count += 1

                if queried_snuba:
                    inferred_with_query += 1
                    RATE_LIMIT_CACHE[saved_query.organization_id] = int(time())
                else:
                    inferred_without_query += 1
                did_process = True
        except (
            snuba.RateLimitExceeded,
            snuba.QueryConnectionFailed,
            snuba.QueryTooManySimultaneous,
        ) as e:
            # These are errors that should be okay to be retried on the next batch.
            sentry_sdk.capture_exception(
                e,
                contexts={
                    "discover_saved_query_id": saved_query.id,
                    "organization_id": saved_query.organization.id,
                },
            )
            inferred_with_query += 1

            # We've hit rate limits / resource limits, wait 1 minute
            # before trying this organization again.
            RATE_LIMIT_CACHE[saved_query.organization_id] = int(time()) + 60
            errored_query_count += 1

        except SoftTimeLimitExceeded:
            errored_query_count += 1
            logger.warning(
                "SoftTimeLimitExceeded",
                extra={
                    "transaction_dataset_count": transaction_dataset_count,
                    "error_dataset_count": error_dataset_count,
                    "errored_query_count": errored_query_count,
                    "inferred_with_query": inferred_with_query,
                    "inferred_without_query": inferred_without_query,
                    "saved_query_id": saved_query.id,
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

    if not did_process:
        raise NoOpException

    logger.info(
        "sentry.tasks.split_discover_query_dataset - no more queries to process",
        extra={
            "transaction_dataset_count": transaction_dataset_count,
            "error_dataset_count": error_dataset_count,
            "errored_query_count": errored_query_count,
            "inferred_with_query": inferred_with_query,
            "inferred_without_query": inferred_without_query,
        },
    )


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

    consecutive_noop_attempts = 0
    while consecutive_noop_attempts <= MAX_NOOP_ATTEMPTS:
        try:
            _split_discover_query_dataset(dry_run)

        except EmptyQueryset:
            break
        except TaskKilled:
            logger.warning("Kill switch enabled.")
            break
        except NoOpException:
            consecutive_noop_attempts += 1
            sleep(SLEEP_FOR)
        else:
            consecutive_noop_attempts = 0
