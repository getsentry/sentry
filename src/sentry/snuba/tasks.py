from __future__ import absolute_import

import json

from sentry.api.event_search import get_filter
from sentry.snuba.discover import resolve_discover_aliases
from sentry.snuba.models import (
    QueryAggregations,
    QueryDatasets,
    QuerySubscription,
    query_aggregation_to_snuba,
)
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.snuba import _snuba_pool, SnubaError


@instrumented_task(
    name="sentry.snuba.tasks.create_subscription_in_snuba",
    queue="subscriptions",
    default_retry_delay=5,
    max_retries=5,
)
def create_subscription_in_snuba(query_subscription_id):
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
def update_subscription_in_snuba(query_subscription_id):
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
        _delete_from_snuba(QueryDatasets(subscription.dataset), subscription.subscription_id)

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
def delete_subscription_from_snuba(query_subscription_id):
    """
    Task to delete a corresponding subscription in Snuba from a `QuerySubscription` in
    Sentry. Deletes the local subscription once we've successfully removed from Snuba.
    """
    try:
        subscription = QuerySubscription.objects.get(id=query_subscription_id)
    except QuerySubscription.DoesNotExist:
        metrics.incr("snuba.subscriptions.delete.subscription_does_not_exist")
        return

    if subscription.status != QuerySubscription.Status.DELETING.value:
        metrics.incr("snuba.subscriptions.delete.incorrect_status")
        return

    if subscription.subscription_id is not None:
        _delete_from_snuba(QueryDatasets(subscription.dataset), subscription.subscription_id)

    subscription.delete()


def _create_in_snuba(subscription):
    conditions = resolve_discover_aliases(
        {"conditions": get_filter(subscription.query).conditions}
    )[0]["conditions"]
    environments = list(subscription.environments.all())
    if environments:
        conditions.append(["environment", "IN", [env.name for env in environments]])
    response = _snuba_pool.urlopen(
        "POST",
        "/%s/subscriptions" % (subscription.dataset,),
        body=json.dumps(
            {
                "project_id": subscription.project_id,
                "dataset": subscription.dataset,
                # We only care about conditions here. Filter keys only matter for
                # filtering to project and groups. Projects are handled with an
                # explicit param, and groups can't be queried here.
                "conditions": conditions,
                "aggregations": [
                    query_aggregation_to_snuba[QueryAggregations(subscription.aggregation)]
                ],
                "time_window": subscription.time_window,
                "resolution": subscription.resolution,
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
