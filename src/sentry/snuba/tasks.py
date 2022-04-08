import logging
from datetime import timedelta

import sentry_sdk
from django.utils import timezone
from snuba_sdk.legacy import json_to_snql

from sentry.eventstore import Filter
from sentry.models import Any, Environment, Mapping, Optional
from sentry.snuba.dataset import EntityKey
from sentry.snuba.entity_subscription import (
    BaseEntitySubscription,
    get_entity_subscription_for_dataset,
    map_aggregate_to_entity_key,
)
from sentry.snuba.models import QueryDatasets, QuerySubscription
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics
from sentry.utils.snuba import SnubaError, _snuba_pool

logger = logging.getLogger(__name__)


SUBSCRIPTION_STATUS_MAX_AGE = timedelta(minutes=10)


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
        query_dataset = QueryDatasets(subscription.snuba_query.dataset)
        entity_key: EntityKey = map_aggregate_to_entity_key(
            query_dataset, subscription.snuba_query.aggregate
        )
        try:
            _delete_from_snuba(
                query_dataset,
                subscription.subscription_id,
                entity_key,
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
        entity_key: EntityKey = map_aggregate_to_entity_key(
            QueryDatasets(dataset), subscription.snuba_query.aggregate
        )
        _delete_from_snuba(
            QueryDatasets(dataset),
            subscription.subscription_id,
            entity_key,
        )

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
        query_dataset = QueryDatasets(subscription.snuba_query.dataset)
        entity_key: EntityKey = map_aggregate_to_entity_key(
            query_dataset, subscription.snuba_query.aggregate
        )
        _delete_from_snuba(
            query_dataset,
            subscription.subscription_id,
            entity_key,
        )

    if subscription.status == QuerySubscription.Status.DELETING.value:
        subscription.delete()
    else:
        subscription.update(subscription_id=None)


def build_snuba_filter(
    entity_subscription: BaseEntitySubscription,
    query: str,
    environment: Optional[Environment],
    params: Optional[Mapping[str, Any]] = None,
) -> Filter:
    return entity_subscription.build_snuba_filter(query, environment, params)


def _create_in_snuba(subscription: QuerySubscription) -> str:
    snuba_query = subscription.snuba_query
    entity_subscription = get_entity_subscription_for_dataset(
        dataset=QueryDatasets(snuba_query.dataset),
        aggregate=snuba_query.aggregate,
        time_window=snuba_query.time_window,
        extra_fields={
            "org_id": subscription.project.organization_id,
            "event_types": snuba_query.event_types,
        },
    )
    snuba_filter = build_snuba_filter(
        entity_subscription,
        snuba_query.query,
        snuba_query.environment,
    )

    body = {
        "project_id": subscription.project_id,
        "project": subscription.project_id,  # for SnQL SDK
        "dataset": snuba_query.dataset,
        "conditions": snuba_filter.conditions,
        "aggregations": snuba_filter.aggregations,
        "time_window": snuba_query.time_window,
        "resolution": snuba_query.resolution,
        **entity_subscription.get_entity_extra_params(),
    }

    try:
        metrics.incr("snuba.snql.subscription.create", tags={"dataset": snuba_query.dataset})
        snql_query = json_to_snql(body, entity_subscription.entity_key.value)
        snql_query.validate()
        body["query"] = str(snql_query)
        body["type"] = "delegate"  # mark this as a combined subscription
    except Exception as e:
        logger.warning(
            "snuba.snql.subscription.parsing.error",
            extra={"error": str(e), "params": json.dumps(body), "dataset": snuba_query.dataset},
        )
        metrics.incr("snuba.snql.subscription.parsing.error", tags={"dataset": snuba_query.dataset})

    response = _snuba_pool.urlopen(
        "POST",
        f"/{snuba_query.dataset}/{entity_subscription.entity_key.value}/subscriptions",
        body=json.dumps(body),
    )
    if response.status != 202:
        metrics.incr("snuba.snql.subscription.http.error", tags={"dataset": snuba_query.dataset})
        raise SnubaError("HTTP %s response from Snuba!" % response.status)
    return json.loads(response.data)["subscription_id"]


def _delete_from_snuba(dataset: QueryDatasets, subscription_id: str, entity_key: EntityKey) -> None:
    response = _snuba_pool.urlopen(
        "DELETE", f"/{dataset.value}/{entity_key.value}/subscriptions/{subscription_id}"
    )
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
