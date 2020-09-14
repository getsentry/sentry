from __future__ import absolute_import

from sentry.api.event_search import get_filter, resolve_field_list
from sentry.snuba.models import QueryDatasets, QuerySubscription
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics, json
from sentry.utils.snuba import (
    _snuba_pool,
    Dataset,
    SnubaError,
    resolve_snuba_aliases,
    resolve_column,
)


# TODO: If we want to support security events here we'll need a way to
# differentiate within the dataset. For now we can just assume all subscriptions
# created within this dataset are just for errors.
DATASET_CONDITIONS = {QueryDatasets.EVENTS: [["type", "=", "error"]]}


def apply_dataset_conditions(dataset, conditions):
    if dataset in DATASET_CONDITIONS:
        conditions = conditions + DATASET_CONDITIONS[dataset]
    return conditions


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
        return
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


def build_snuba_filter(dataset, query, aggregate, environment, params=None):
    resolve_func = (
        resolve_column(Dataset.Events)
        if dataset == QueryDatasets.EVENTS
        else resolve_column(Dataset.Transactions)
    )
    snuba_filter = get_filter(query, params=params)
    snuba_filter.update_with(resolve_field_list([aggregate], snuba_filter, auto_fields=False))
    snuba_filter = resolve_snuba_aliases(snuba_filter, resolve_func)[0]
    if environment:
        snuba_filter.conditions.append(["environment", "=", environment.name])
    snuba_filter.conditions = apply_dataset_conditions(dataset, snuba_filter.conditions)
    return snuba_filter


def _create_in_snuba(subscription):
    snuba_query = subscription.snuba_query
    snuba_filter = build_snuba_filter(
        QueryDatasets(snuba_query.dataset),
        snuba_query.query,
        snuba_query.aggregate,
        snuba_query.environment,
    )
    response = _snuba_pool.urlopen(
        "POST",
        "/%s/subscriptions" % (snuba_query.dataset,),
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


def _delete_from_snuba(dataset, subscription_id):
    response = _snuba_pool.urlopen(
        "DELETE", "/%s/subscriptions/%s" % (dataset.value, subscription_id)
    )
    if response.status != 202:
        raise SnubaError("HTTP %s response from Snuba!" % response.status)
