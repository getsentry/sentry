from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import orjson
import sentry_sdk
from django.db import router, transaction
from django.utils import timezone
from sentry_protos.snuba.v1.endpoint_create_subscription_pb2 import CreateSubscriptionRequest
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest
from sentry_sdk import traces
from snuba_sdk import Request
from taskbroker_client.retry import Retry

from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events.types import ParamsType
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.entity_subscription import (
    BaseEntitySubscription,
    get_entity_key_from_query_builder,
    get_entity_key_from_request,
    get_entity_key_from_snuba_query,
    get_entity_subscription,
    get_entity_subscription_from_snuba_query,
)
from sentry.snuba.models import ExtrapolationMode, QuerySubscription, SnubaQuery
from sentry.snuba.utils import build_query_strings
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import alerts_tasks
from sentry.utils import metrics, snuba_rpc
from sentry.utils.cursored_scheduler import CursoredScheduler
from sentry.utils.snuba import SNUBA_INFO, SnubaError, _snuba_pool

logger = logging.getLogger(__name__)


SUBSCRIPTION_STATUS_MAX_AGE = timedelta(minutes=10)
# How long a subscription's query must keep failing to build before we mark it BROKEN.
# Some failures are transient, e.g. a metrics filter value that hasn't been indexed yet.
BROKEN_GRACE_PERIOD = timedelta(hours=1)


class SubscriptionError(Exception):
    pass


@instrumented_task(
    name="sentry.snuba.tasks.create_subscription_in_snuba",
    namespace=alerts_tasks,
    retry=Retry(times=5, delay=5),
)
def create_subscription_in_snuba(query_subscription_id: int, **kwargs: Any) -> None:
    """
    Task to create a corresponding subscription in Snuba from a `QuerySubscription` in
    Sentry. We store the snuba subscription id locally on success.

    TODO: utilize query_extra from QuerySubscription in request
    """
    try:
        subscription = QuerySubscription.objects.get(id=query_subscription_id)
    except QuerySubscription.DoesNotExist:
        metrics.incr("snuba.subscriptions.create.subscription_does_not_exist")
        return
    if subscription.status != QuerySubscription.Status.CREATING.value:
        metrics.incr("snuba.subscriptions.create.incorrect_status")
        return
    if subscription.subscription_id is not None and subscription.snuba_query is not None:
        metrics.incr("snuba.subscriptions.create.already_created_in_snuba")
        # This mostly shouldn't happen, but it's possible that a subscription can get
        # into this state. Just attempt to delete the existing subscription and then
        # create a new one.
        query_dataset = Dataset(subscription.snuba_query.dataset)
        entity_key = _get_entity_key_for_delete(subscription, "create")
        if entity_key is not None:
            try:
                _delete_from_snuba(
                    query_dataset,
                    subscription.subscription_id,
                    entity_key,
                )
            except SnubaError:
                logger.exception("Failed to delete subscription")

    try:
        subscription_id = _create_in_snuba(subscription)
    except SubscriptionError as e:
        _maybe_mark_broken(subscription, "create", e)
        return
    subscription.update(
        status=QuerySubscription.Status.ACTIVE.value, subscription_id=subscription_id
    )


@instrumented_task(
    name="sentry.snuba.tasks.update_subscription_in_snuba",
    namespace=alerts_tasks,
    retry=Retry(times=5, delay=5),
)
def update_subscription_in_snuba(
    query_subscription_id: int,
    old_query_type: int | None = None,
    old_dataset: str | None = None,
    old_aggregate: str | None = None,
    old_query: str | None = None,
    **kwargs: Any,
) -> None:
    """
    Task to update a corresponding subscription in Snuba from a `QuerySubscription` in
    Sentry. Updating in Snuba means deleting the existing subscription, then creating a
    new one.
    """
    try:
        subscription = QuerySubscription.objects.get(id=query_subscription_id)
    except QuerySubscription.DoesNotExist:
        metrics.incr("snuba.subscriptions.update.subscription_does_not_exist")
        return

    if subscription.status != QuerySubscription.Status.UPDATING.value:
        metrics.incr("snuba.subscriptions.update.incorrect_status")
        return

    if subscription.subscription_id is not None and subscription.snuba_query is not None:
        dataset = Dataset(
            old_dataset if old_dataset is not None else subscription.snuba_query.dataset
        )
        query_type = SnubaQuery.Type(
            old_query_type if old_query_type is not None else subscription.snuba_query.type
        )
        query = old_query if old_query is not None else subscription.snuba_query.query
        aggregate = (
            old_aggregate if old_aggregate is not None else subscription.snuba_query.aggregate
        )
        try:
            old_entity_subscription = get_entity_subscription(
                query_type,
                dataset,
                aggregate,
                subscription.snuba_query.time_window,
                extra_fields={
                    "org_id": subscription.project.organization_id,
                    "event_types": subscription.snuba_query.event_types,
                    "extrapolation_mode": ExtrapolationMode(
                        subscription.snuba_query.extrapolation_mode
                    ),
                },
            )
            old_entity_key: EntityKey | None = (
                EntityKey.EAPItems
                if dataset == Dataset.EventsAnalyticsPlatform
                else get_entity_key_from_query_builder(
                    old_entity_subscription.build_query_builder(
                        query,
                        [subscription.project_id],
                        None,
                        {"organization_id": subscription.project.organization_id},
                        skip_field_validation_for_entity_subscription_deletion=True,
                    ),
                )
            )
        except (InvalidSearchQuery, IncompatibleMetricsQuery):
            _record_unresolved_entity_key("update")
            old_entity_key = None
        if old_entity_key is not None:
            _delete_from_snuba(
                Dataset(dataset),
                subscription.subscription_id,
                old_entity_key,
            )

    try:
        subscription_id = _create_in_snuba(subscription)
    except SubscriptionError as e:
        _maybe_mark_broken(subscription, "update", e)
        return
    subscription.update(
        status=QuerySubscription.Status.ACTIVE.value, subscription_id=subscription_id
    )


@instrumented_task(
    name="sentry.snuba.tasks.delete_subscription_from_snuba",
    namespace=alerts_tasks,
    retry=Retry(times=5, delay=5),
)
def delete_subscription_from_snuba(query_subscription_id: int, **kwargs: Any) -> None:
    """
    Task to delete a corresponding subscription in Snuba from a `QuerySubscription` in
    Sentry.
    If the local subscription is marked for deletion (as opposed to disabled),
    then we delete the local subscription once we've successfully removed from Snuba.
    """
    from sentry.incidents.models.alert_rule import AlertRule

    try:
        subscription = QuerySubscription.objects.get(id=query_subscription_id)
    except QuerySubscription.DoesNotExist:
        metrics.incr("snuba.subscriptions.delete.subscription_does_not_exist")
        return

    if subscription.status not in [
        QuerySubscription.Status.DELETING.value,
        QuerySubscription.Status.DISABLED.value,
    ]:
        metrics.incr("snuba.subscriptions.delete.incorrect_status")
        return

    if subscription.subscription_id is not None and subscription.snuba_query is not None:
        query_dataset = Dataset(subscription.snuba_query.dataset)
        if query_dataset == Dataset.PerformanceMetrics:
            # Snuba dropped the generic_metrics dataset and its subscriptions, and the indexer
            # can no longer resolve the tags these queries use, so only the local rows remain.
            metrics.incr("snuba.subscriptions.delete.removed_dataset")
        else:
            entity_key = _get_entity_key_for_delete(subscription, "delete")
            if entity_key is not None:
                _delete_from_snuba(
                    query_dataset,
                    subscription.subscription_id,
                    entity_key,
                )

    if subscription.status == QuerySubscription.Status.DELETING.value:
        snuba_query = subscription.snuba_query
        subscription.delete()
        # check that there are no subscriptions left related to the SnubaQuery before deleting
        # add a check for the alert rule - in the snapshot case we could fall in here but the alert rule isn't deleted
        if (
            snuba_query
            and not QuerySubscription.objects.filter(snuba_query=snuba_query.id).exists()
            and not AlertRule.objects_with_snapshots.filter(snuba_query=snuba_query.id).exists()
        ):
            snuba_query.delete()
    else:
        subscription.update(subscription_id=None)


def _record_unresolved_entity_key(action: str) -> None:
    # We can't tell Snuba which entity to delete from, so we leave the Snuba
    # subscription in place. Once no QuerySubscription has its subscription_id, the
    # subscription consumer deletes it when its next result arrives.
    metrics.incr("snuba.subscriptions.entity_key_unresolved", tags={"action": action})


def _get_entity_key_for_delete(subscription: QuerySubscription, action: str) -> EntityKey | None:
    try:
        return get_entity_key_from_snuba_query(
            subscription.snuba_query,
            subscription.project.organization_id,
            subscription.project_id,
            skip_field_validation_for_entity_subscription_deletion=True,
        )
    except (InvalidSearchQuery, IncompatibleMetricsQuery):
        _record_unresolved_entity_key(action)
        return None


def _maybe_mark_broken(
    subscription: QuerySubscription, action: str, error: SubscriptionError
) -> bool:
    """
    Marks a subscription whose query has failed to build, or been rejected by Snuba,
    for longer than BROKEN_GRACE_PERIOD as BROKEN, so that `subscription_checker` stops
    retrying it.
    Until then, it's left as is for `subscription_checker` to retry.
    Returns whether the subscription was marked BROKEN.
    """
    with transaction.atomic(router.db_for_write(QuerySubscription)):
        # Check against the locked row, so that we skip if a concurrent edit or delete
        # changed its status or restarted the grace period since we loaded it.
        # Model.update (rather than QuerySet.update) clears the cached subscription_id
        # lookup.
        current = QuerySubscription.objects.select_for_update().get_or_none(
            id=subscription.id, status=subscription.status
        )
        if current is None or (
            current.date_updated is not None
            and timezone.now() - current.date_updated < BROKEN_GRACE_PERIOD
        ):
            return False
        current.update(
            status=QuerySubscription.Status.BROKEN.value,
            subscription_id=None,
            date_updated=timezone.now(),
        )

    tags = {
        "action": action,
        "dataset": subscription.snuba_query.dataset,
        "error_type": type(error.__cause__ or error).__name__,
    }
    metrics.incr("snuba.subscriptions.marked_broken", tags=tags)
    # Already-BROKEN subscriptions aren't retried, so this reports each one once.
    sentry_sdk.capture_exception(
        error,
        tags=tags,
        contexts={
            "query_subscription": {
                "id": subscription.id,
                "snuba_query_id": subscription.snuba_query_id,
            }
        },
    )
    return True


def _create_in_snuba(subscription: QuerySubscription) -> str:
    with traces.start_span(
        name="create_in_snuba",
        attributes={
            "sentry.op": "snuba.tasks",
            "dataset": subscription.snuba_query.dataset,
        },
    ):
        snuba_query = subscription.snuba_query
        entity_subscription, request = _build_snuba_request(subscription)
        if isinstance(request, TimeSeriesRequest):
            return _create_rpc_in_snuba(subscription, snuba_query, request, entity_subscription)
        return _create_snql_in_snuba(subscription, snuba_query, request, entity_subscription)


def _build_snuba_request(
    subscription: QuerySubscription,
) -> tuple[BaseEntitySubscription, TimeSeriesRequest | Request]:
    """
    Builds the request used to create the subscription in Snuba.
    Raises SubscriptionError if the query can't be built.
    """
    snuba_query = subscription.snuba_query
    entity_subscription = get_entity_subscription_from_snuba_query(
        snuba_query,
        subscription.project.organization_id,
    )
    query_string = build_query_strings(subscription, snuba_query).query_string
    params: ParamsType = {
        "organization_id": subscription.project.organization_id,
        "project_id": [subscription.project_id],
    }
    try:
        if entity_subscription.dataset == Dataset.EventsAnalyticsPlatform:
            return entity_subscription, entity_subscription.build_rpc_request(
                query=query_string,
                project_ids=[subscription.project_id],
                environment=snuba_query.environment,
                params=params,
            )
        return entity_subscription, entity_subscription.build_query_builder(
            query=query_string,
            project_ids=[subscription.project_id],
            environment=snuba_query.environment,
            params=params,
        ).get_snql_query()
    except (InvalidSearchQuery, IncompatibleMetricsQuery) as e:
        raise SubscriptionError(e) from e


# This indirection function only exists such that snql queries can be rewritten
# by sentry.utils.pytest.metrics
def _create_snql_in_snuba(
    subscription: QuerySubscription,
    snuba_query: SnubaQuery,
    snql_query: Request,
    entity_subscription: BaseEntitySubscription,
) -> str:
    body = {
        "project_id": subscription.project_id,
        "query": str(snql_query.query),
        "time_window": snuba_query.time_window,
        "resolution": snuba_query.resolution,
        **entity_subscription.get_entity_extra_params(),
    }
    if SNUBA_INFO:
        import pprint

        print(  # noqa: S002, T201 -- only prints when an env variable is set
            f"subscription.body:\n {pprint.pformat(body)}"
        )

    entity_key = get_entity_key_from_request(snql_query)

    post_body: str | bytes = orjson.dumps(body)
    response = _snuba_pool.urlopen(
        "POST",
        f"/{snuba_query.dataset}/{entity_key.value}/subscriptions",
        body=post_body,
    )
    if response.status != 202:
        metrics.incr("snuba.snql.subscription.http.error", tags={"dataset": snuba_query.dataset})
        error = SnubaError(
            f"HTTP {response.status} response from Snuba: {_response_text(response.data)}"
        )
        # Snuba rejected the subscription itself (e.g. an out-of-range time window), so
        # retrying won't help. Rate limiting is transient, so it's retried as usual.
        if 400 <= response.status < 500 and response.status != 429:
            raise SubscriptionError(error) from error
        raise error

    subscription_id = orjson.loads(response.data)["subscription_id"]
    return subscription_id


def _response_text(data: bytes) -> str:
    return data[:500].decode("utf-8", errors="replace")


def _create_rpc_in_snuba(
    subscription: QuerySubscription,
    snuba_query: SnubaQuery,
    rpc_time_series_request: TimeSeriesRequest,
    entity_subscription: BaseEntitySubscription,
) -> str:
    subscription_request = CreateSubscriptionRequest(
        time_series_request=rpc_time_series_request,
        time_window_secs=snuba_query.time_window,
        resolution_secs=snuba_query.resolution,
    )

    try:
        response = snuba_rpc.create_subscription(subscription_request)
    except snuba_rpc.SnubaRPCError as e:
        metrics.incr("snuba.snql.subscription.http.error", tags={"dataset": snuba_query.dataset})
        if isinstance(e, snuba_rpc.SnubaRPCBadRequest):
            raise SubscriptionError(e) from e
        raise

    return response.subscription_id


def _delete_from_snuba(dataset: Dataset, subscription_id: str, entity_key: EntityKey) -> None:
    response = _snuba_pool.urlopen(
        "DELETE", f"/{dataset.value}/{entity_key.value}/subscriptions/{subscription_id}"
    )
    if response.status != 202:
        raise SnubaError(
            f"HTTP {response.status} response from Snuba: {_response_text(response.data)}"
        )


@instrumented_task(
    name="sentry.snuba.tasks.subscription_checker",
    namespace=alerts_tasks,
)
def subscription_checker(**kwargs: Any) -> None:
    """
    Checks for subscriptions stuck in a transition status and attempts to repair them
    """
    count = 0
    for subscription in QuerySubscription.objects.filter(
        status__in=(
            QuerySubscription.Status.CREATING.value,
            QuerySubscription.Status.UPDATING.value,
            QuerySubscription.Status.DELETING.value,
        ),
        date_updated__lt=timezone.now() - SUBSCRIPTION_STATUS_MAX_AGE,
    ):
        with traces.start_span(
            name="repair_subscription",
            attributes={
                "sentry.op": "repair_subscription",
                "subscription_id": subscription.id,
                "status": subscription.status,
            },
        ):
            count += 1
            if subscription.status == QuerySubscription.Status.CREATING.value:
                create_subscription_in_snuba.delay(query_subscription_id=subscription.id)
            elif subscription.status == QuerySubscription.Status.UPDATING.value:
                update_subscription_in_snuba.delay(query_subscription_id=subscription.id)
            elif subscription.status == QuerySubscription.Status.DELETING.value:
                delete_subscription_from_snuba.delay(query_subscription_id=subscription.id)

    metrics.incr("snuba.subscriptions.repair", amount=count)


@instrumented_task(
    name="sentry.snuba.tasks.recheck_broken_subscription",
    namespace=alerts_tasks,
)
def recheck_broken_subscription(query_subscription_id: int, **kwargs: Any) -> None:
    """
    Checks whether a BROKEN subscription is valid now (e.g. a removed environment was
    restored) by creating it in Snuba. If its query still can't be built, or Snuba still
    rejects it, it stays BROKEN without being reported again.
    """
    try:
        subscription = QuerySubscription.objects.get(id=query_subscription_id)
    except QuerySubscription.DoesNotExist:
        return
    if subscription.status != QuerySubscription.Status.BROKEN.value:
        return

    try:
        subscription_id = _create_in_snuba(subscription)
    except SubscriptionError:
        metrics.incr("snuba.subscriptions.broken.verified")
        return

    with transaction.atomic(router.db_for_write(QuerySubscription)):
        # Edits and deletes change the status and date_updated, so this only matches if
        # the subscription wasn't modified during the Snuba call.
        current = QuerySubscription.objects.select_for_update().get_or_none(
            id=subscription.id,
            status=QuerySubscription.Status.BROKEN.value,
            date_updated=subscription.date_updated,
        )
        if current is None:
            # The new Snuba subscription is unreferenced, so the consumer deletes it when
            # it sees its results.
            return
        current.update(
            status=QuerySubscription.Status.ACTIVE.value,
            subscription_id=subscription_id,
            date_updated=timezone.now(),
        )
    metrics.incr("snuba.subscriptions.broken.recovered")


# Re-check regularly so that broken subscriptions get re-enabled automatically once
# their queries can be built again.
@instrumented_task(
    name="sentry.snuba.tasks.schedule_broken_subscription_rechecks",
    namespace=alerts_tasks,
)
def schedule_broken_subscription_rechecks(**kwargs: Any) -> None:
    CursoredScheduler(
        name="snuba_broken_subscription_recheck",
        schedule_key="snuba-broken-subscription-recheck",
        queryset=QuerySubscription.objects.filter(status=QuerySubscription.Status.BROKEN.value),
        task=recheck_broken_subscription,
        cycle_duration=timedelta(days=1),
    ).tick()
