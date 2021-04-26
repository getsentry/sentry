import logging
from datetime import timedelta

import sentry_sdk
from django.utils import timezone

from sentry.search.events.fields import resolve_field_list
from sentry.search.events.filter import get_filter
from sentry.snuba.models import QueryDatasets, QuerySubscription
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics
from sentry.utils.snuba import (
    Dataset,
    SnubaError,
    _snuba_pool,
    resolve_column,
    resolve_snuba_aliases,
)

logger = logging.getLogger(__name__)


# TODO: If we want to support security events here we'll need a way to
# differentiate within the dataset. For now we can just assume all subscriptions
# created within this dataset are just for errors.
DATASET_CONDITIONS = {
    QueryDatasets.EVENTS: "event.type:error",
    QueryDatasets.TRANSACTIONS: "event.type:transaction",
}
SUBSCRIPTION_STATUS_MAX_AGE = timedelta(minutes=10)


def apply_dataset_query_conditions(dataset, query, event_types, discover=False):
    """
    Applies query dataset conditions to a query. This essentially turns a query like
    'release:123 or release:456' into '(event.type:error) AND (release:123 or release:456)'.
    :param dataset: The `QueryDataset` that the query applies to
    :param query: A string containing query to apply conditions to
    :param event_types: A list of EventType(s) to apply to the query
    :param discover: Whether this is intended for use with the discover dataset or not.
    When False, we won't modify queries for `QueryDatasets.TRANSACTIONS` at all. This is
    because the discover dataset requires that we always specify `event.type` so we can
    differentiate between errors and transactions, but the TRANSACTIONS dataset doesn't
    need it specified, and `event.type` ends up becoming a tag search.
    """
    if not discover and dataset == QueryDatasets.TRANSACTIONS:
        return query
    if event_types:
        event_type_conditions = " OR ".join(
            [f"event.type:{event_type.name.lower()}" for event_type in event_types]
        )
    elif dataset in DATASET_CONDITIONS:
        event_type_conditions = DATASET_CONDITIONS[dataset]
    else:
        return query

    return f"({event_type_conditions}) AND ({query})"


@instrumented_task(
    name="sentry.snuba.tasks.create_subscription_in_snuba",
    queue="subscriptions",
    default_retry_delay=5,
    max_retries=5,
)
def create_subscription_in_snuba(query_subscription_id, **kwargs):
    """
    Task to create a corresponding subscription in Snuba from a `QuerySubscription` in
    Sentry. We store the snuba subscription id locally on success.
    """
    try:
        subscription = QuerySubscription.objects.get(id=query_subscription_id)
    except QuerySubscription.DoesNotExist:
        metrics.incr("snuba.subscriptions.create.subscription_does_not_exist")
        return
    if subscription.status != QuerySubscription.Status.CREATING.value:
        metrics.incr("snuba.subscriptions.create.incorrect_status")
        return
    if subscription.subscription_id is not None:
        metrics.incr("snuba.subscriptions.create.already_created_in_snuba")
        # This mostly shouldn't happen, but it's possible that a subscription can get
        # into this state. Just attempt to delete the existing subscription and then
        # create a new one.
        try:
            _delete_from_snuba(
                QueryDatasets(subscription.snuba_query.dataset), subscription.subscription_id
            )
        except SnubaError:
            logger.exception("Failed to delete subscription")

    subscription_id = _create_in_snuba(subscription)
    subscription.update(
        status=QuerySubscription.Status.ACTIVE.value, subscription_id=subscription_id
    )


@instrumented_task(
    name="sentry.snuba.tasks.update_subscription_in_snuba",
    queue="subscriptions",
    default_retry_delay=5,
    max_retries=5,
)
def update_subscription_in_snuba(query_subscription_id, old_dataset=None, **kwargs):
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

    if subscription.subscription_id is not None:
        dataset = old_dataset if old_dataset is not None else subscription.snuba_query.dataset
        _delete_from_snuba(QueryDatasets(dataset), subscription.subscription_id)

    subscription_id = _create_in_snuba(subscription)
    subscription.update(
        status=QuerySubscription.Status.ACTIVE.value, subscription_id=subscription_id
    )


@instrumented_task(
    name="sentry.snuba.tasks.delete_subscription_from_snuba",
    queue="subscriptions",
    default_retry_delay=5,
    max_retries=5,
)
def delete_subscription_from_snuba(query_subscription_id, **kwargs):
    """
    Task to delete a corresponding subscription in Snuba from a `QuerySubscription` in
    Sentry.
    If the local subscription is marked for deletion (as opposed to disabled),
    then we delete the local subscription once we've successfully removed from Snuba.
    """
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

    if subscription.subscription_id is not None:
        _delete_from_snuba(
            QueryDatasets(subscription.snuba_query.dataset), subscription.subscription_id
        )

    if subscription.status == QuerySubscription.Status.DELETING.value:
        subscription.delete()
    else:
        subscription.update(subscription_id=None)


def build_snuba_filter(dataset, query, aggregate, environment, event_types, params=None):
    resolve_func = (
        resolve_column(Dataset.Events)
        if dataset == QueryDatasets.EVENTS
        else resolve_column(Dataset.Transactions)
    )
    query = apply_dataset_query_conditions(dataset, query, event_types)
    snuba_filter = get_filter(query, params=params)
    snuba_filter.update_with(resolve_field_list([aggregate], snuba_filter, auto_fields=False))
    snuba_filter = resolve_snuba_aliases(snuba_filter, resolve_func)[0]
    if snuba_filter.group_ids:
        snuba_filter.conditions.append(["group_id", "IN", list(map(int, snuba_filter.group_ids))])
    if environment:
        snuba_filter.conditions.append(["environment", "=", environment.name])
    return snuba_filter


def _create_in_snuba(subscription):
    snuba_query = subscription.snuba_query
    snuba_filter = build_snuba_filter(
        QueryDatasets(snuba_query.dataset),
        snuba_query.query,
        snuba_query.aggregate,
        snuba_query.environment,
        snuba_query.event_types,
    )
    response = _snuba_pool.urlopen(
        "POST",
        f"/{snuba_query.dataset}/subscriptions",
        body=json.dumps(
            {
                "project_id": subscription.project_id,
                "dataset": snuba_query.dataset,
                "conditions": snuba_filter.conditions,
                "aggregations": snuba_filter.aggregations,
                "time_window": snuba_query.time_window,
                "resolution": snuba_query.resolution,
            }
        ),
    )
    if response.status != 202:
        raise SnubaError("HTTP %s response from Snuba!" % response.status)
    return json.loads(response.data)["subscription_id"]


def _delete_from_snuba(dataset: QueryDatasets, subscription_id: str) -> None:
    response = _snuba_pool.urlopen("DELETE", f"/{dataset.value}/subscriptions/{subscription_id}")
    if response.status != 202:
        raise SnubaError("HTTP %s response from Snuba!" % response.status)


@instrumented_task(
    name="sentry.snuba.tasks.subscription_checker",
    queue="subscriptions",
)
def subscription_checker(**kwargs):
    """
    Checks for subscriptions stuck in a transition status and attempts to repair them
    """
    count = 0
    with sentry_sdk.start_transaction(
        op="subscription_checker",
        name="subscription_checker",
        sampled=False,
    ):
        for subscription in QuerySubscription.objects.filter(
            status__in=(
                QuerySubscription.Status.CREATING.value,
                QuerySubscription.Status.UPDATING.value,
                QuerySubscription.Status.DELETING.value,
            ),
            date_updated__lt=timezone.now() - SUBSCRIPTION_STATUS_MAX_AGE,
        ):
            with sentry_sdk.start_span(op="repair_subscription") as span:
                span.set_data("subscription_id", subscription.id)
                span.set_data("status", subscription.status)
                count += 1
                if subscription.status == QuerySubscription.Status.CREATING.value:
                    create_subscription_in_snuba.delay(query_subscription_id=subscription.id)
                elif subscription.status == QuerySubscription.Status.UPDATING.value:
                    update_subscription_in_snuba.delay(query_subscription_id=subscription.id)
                elif subscription.status == QuerySubscription.Status.DELETING.value:
                    delete_subscription_from_snuba.delay(query_subscription_id=subscription.id)

    metrics.incr("snuba.subscriptions.repair", amount=count)
