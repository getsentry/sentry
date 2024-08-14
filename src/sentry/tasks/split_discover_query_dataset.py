import sentry_sdk
from celery.exceptions import SoftTimeLimitExceeded

from sentry import options
from sentry.discover.dataset_split import save_split_decision_for_query
from sentry.discover.models import DatasetSourcesTypes, DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.tasks.base import instrumented_task
from sentry.utils import snuba


@instrumented_task(
    name="sentry.tasks.split_discover_dataset",
    queue="split_discover_dataset",
    max_retries=0,
    soft_time_limit=150,
    time_limit=180,
    expires=360,
)
def schedule_discover_query_dataset_split():
    # Kill switch
    if not options.get("discover.saved-query-dataset-split.enable"):
        return

    organization_allowlist = options.get(
        "discover.saved-query-dataset-split.organization-allowlist"
    )
    queryset = DiscoverSavedQuery.objects.filter(
        organization_id__in=organization_allowlist,
        dataset=DiscoverSavedQueryTypes.DISCOVER,
        dataset_source=DatasetSourcesTypes.UNKNOWN,
    )

    batch_size = options.get("discover.saved-query-dataset-split.batch-size")
    saved_queries = queryset[:batch_size]
    ids_in_batch = [q.id for q in saved_queries]

    for saved_query in saved_queries:
        try:
            save_split_decision_for_query(saved_query)
        except SoftTimeLimitExceeded as e:
            sentry_sdk.capture_exception(
                e,
                contexts={
                    "discover_saved_query_id": saved_query.id,
                    "queries_in_batch": ids_in_batch,
                    "organization_id": saved_query.organization.id,
                },
            )
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
        except Exception as e:
            sentry_sdk.capture_exception(
                e,
                contexts={
                    "discover_saved_query_id": saved_query.id,
                    "organization_id": saved_query.organization.id,
                },
            )
            saved_query.dataset_source = DatasetSourcesTypes.SPLIT_ERRORED.value
            saved_query.save()
