from __future__ import annotations

import logging
from datetime import timedelta

import orjson
import sentry_sdk
from django.utils import timezone
from sentry_protos.snuba.v1.endpoint_create_subscription_pb2 import CreateSubscriptionRequest
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest

from sentry import features
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.entity_subscription import (
    get_entity_key_from_query_builder,
    get_entity_key_from_request,
    get_entity_key_from_snuba_query,
    get_entity_subscription,
    get_entity_subscription_from_snuba_query,
)
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.snuba.utils import build_query_strings
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics, snuba_rpc
from sentry.utils.snuba import SNUBA_INFO, SnubaError, _snuba_pool

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
        entity_key = get_entity_key_from_snuba_query(
            subscription.snuba_query, subscription.project.organization_id, subscription.project_id
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
def update_subscription_in_snuba(
    query_subscription_id,
    old_query_type=None,
    old_dataset=None,
    old_aggregate=None,
    old_query=None,
    **kwargs,
):
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
        old_entity_subscription = get_entity_subscription(
            query_type,
            dataset,
            aggregate,
            subscription.snuba_query.time_window,
            extra_fields={
                "org_id": subscription.project.organization_id,
                "event_types": subscription.snuba_query.event_types,
            },
        )
        old_entity_key = (
            EntityKey.EAPSpans
            if dataset == Dataset.EventsAnalyticsPlatform
            else get_entity_key_from_query_builder(
                old_entity_subscription.build_query_builder(
                    query,
                    [subscription.project_id],
                    None,
                    {"organization_id": subscription.project.organization_id},
                ),
            )
        )
        _delete_from_snuba(
            Dataset(dataset),
            subscription.subscription_id,
            old_entity_key,
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
        entity_key = get_entity_key_from_snuba_query(
            subscription.snuba_query,
            subscription.project.organization_id,
            subscription.project_id,
            skip_field_validation_for_entity_subscription_deletion=True,
        )
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


def _create_in_snuba(subscription: QuerySubscription) -> str:
    with sentry_sdk.start_span(op="snuba.tasks", name="create_in_snuba") as span:
        span.set_tag(
            "uses_metrics_layer",
            features.has("organizations:use-metrics-layer", subscription.project.organization),
        )
        span.set_tag("dataset", subscription.snuba_query.dataset)

        snuba_query = subscription.snuba_query
        entity_subscription = get_entity_subscription_from_snuba_query(
            snuba_query,
            subscription.project.organization_id,
        )
        query_string = build_query_strings(subscription, snuba_query).query_string
        if entity_subscription.dataset == Dataset.EventsAnalyticsPlatform:
            rpc_time_series_request = entity_subscription.build_rpc_request(
                query=query_string,
                project_ids=[subscription.project_id],
                environment=snuba_query.environment,
                params={
                    "organization_id": subscription.project.organization_id,
                    "project_id": [subscription.project_id],
                },
            )
            return _create_rpc_in_snuba(
                subscription, snuba_query, rpc_time_series_request, entity_subscription
            )
        else:
            snql_query = entity_subscription.build_query_builder(
                query=query_string,
                project_ids=[subscription.project_id],
                environment=snuba_query.environment,
                params={
                    "organization_id": subscription.project.organization_id,
                    "project_id": [subscription.project_id],
                },
            ).get_snql_query()

            return _create_snql_in_snuba(subscription, snuba_query, snql_query, entity_subscription)


# This indirection function only exists such that snql queries can be rewritten
# by sentry.utils.pytest.metrics
def _create_snql_in_snuba(subscription, snuba_query, snql_query, entity_subscription):
    body = {
        "project_id": subscription.project_id,
        "query": str(snql_query.query),
        "time_window": snuba_query.time_window,
        "resolution": snuba_query.resolution,
        **entity_subscription.get_entity_extra_params(),
    }
    if SNUBA_INFO:
        import pprint

        print(  # NOQA: only prints when an env variable is set
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
        raise SnubaError("HTTP %s response from Snuba!" % response.status)

    return orjson.loads(response.data)["subscription_id"]


def _create_rpc_in_snuba(
    subscription, snuba_query, rpc_time_series_request: TimeSeriesRequest, entity_subscription
):
    subscription_request = CreateSubscriptionRequest(
        time_series_request=rpc_time_series_request,
        time_window_secs=snuba_query.time_window,
        resolution_secs=snuba_query.resolution,
    )

    try:
        response = snuba_rpc.create_subscription(subscription_request)
    except snuba_rpc.SnubaRPCError:
        metrics.incr("snuba.snql.subscription.http.error", tags={"dataset": snuba_query.dataset})
        raise

    return response.subscription_id


def _delete_from_snuba(dataset: Dataset, subscription_id: str, entity_key: EntityKey) -> None:
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
