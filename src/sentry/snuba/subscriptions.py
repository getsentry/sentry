from __future__ import absolute_import

import logging

from django.db import transaction

from sentry.snuba.models import QueryDatasets, QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.tasks import (
    create_subscription_in_snuba,
    delete_subscription_from_snuba,
    update_subscription_in_snuba,
)

logger = logging.getLogger(__name__)


def create_snuba_query(
    dataset, query, aggregate, time_window, resolution, environment, event_types=None
):
    """
    Creates a SnubaQuery.

    :param dataset: The snuba dataset to query and aggregate over
    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param aggregate: An aggregate to calculate over the time window
    :param time_window: The time window to aggregate over
    :param resolution: How often to receive updates/bucket size
    :param environment: An optional environment to filter by
    :param event_types: A (currently) optional list of event_types that apply to this
    query. If not passed, we'll infer a default value based on the dataset.
    :return: A list of QuerySubscriptions
    """
    snuba_query = SnubaQuery.objects.create(
        dataset=dataset.value,
        query=query,
        aggregate=aggregate,
        time_window=int(time_window.total_seconds()),
        resolution=int(resolution.total_seconds()),
        environment=environment,
    )
    if not event_types:
        event_types = [
            SnubaQueryEventType.EventType.ERROR
            if dataset == QueryDatasets.EVENTS
            else SnubaQueryEventType.EventType.TRANSACTION
        ]
    sq_event_types = [
        SnubaQueryEventType(snuba_query=snuba_query, type=event_type.value)
        for event_type in set(event_types)
    ]
    SnubaQueryEventType.objects.bulk_create(sq_event_types)
    return snuba_query


def update_snuba_query(
    snuba_query, dataset, query, aggregate, time_window, resolution, environment
):
    """
    Updates a SnubaQuery. Triggers updates to any related QuerySubscriptions.

    :param snuba_query: The `SnubaQuery` to update.
    :param dataset: The snuba dataset to query and aggregate over
    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param aggregate: An aggregate to calculate over the time window
    :param time_window: The time window to aggregate over
    :param resolution: How often to receive updates/bucket size
    :param environment: An optional environment to filter by
    :return: A list of QuerySubscriptions
    """
    old_dataset = QueryDatasets(snuba_query.dataset)
    with transaction.atomic():
        query_subscriptions = list(snuba_query.subscriptions.all())
        snuba_query.update(
            dataset=dataset.value,
            query=query,
            aggregate=aggregate,
            time_window=int(time_window.total_seconds()),
            resolution=int(resolution.total_seconds()),
            environment=environment,
        )
        bulk_update_snuba_subscriptions(query_subscriptions, old_dataset)


def bulk_create_snuba_subscriptions(projects, subscription_type, snuba_query):
    """
    Creates a subscription to a snuba query for each project.

    :param projects: The projects we're applying the query to
    :param subscription_type: Text identifier for the subscription type this is. Used
    to identify the registered callback associated with this subscription.
    :param snuba_query: A `SnubaQuery` instance to subscribe the projects to.
    :return: A list of QuerySubscriptions
    """
    subscriptions = []
    # TODO: Batch this up properly once we care about multi-project rules.
    for project in projects:
        subscriptions.append(create_snuba_subscription(project, subscription_type, snuba_query))
    return subscriptions


def create_snuba_subscription(project, subscription_type, snuba_query):
    """
    Creates a subscription to a snuba query.

    :param project: The project we're applying the query to
    :param subscription_type: Text identifier for the subscription type this is. Used
    to identify the registered callback associated with this subscription.
    :param snuba_query: A `SnubaQuery` instance to subscribe the project to.
    :return: The QuerySubscription representing the subscription
    """
    subscription = QuerySubscription.objects.create(
        status=QuerySubscription.Status.CREATING.value,
        project=project,
        snuba_query=snuba_query,
        type=subscription_type,
    )
    create_subscription_in_snuba.apply_async(
        kwargs={"query_subscription_id": subscription.id}, countdown=5
    )

    return subscription


def bulk_update_snuba_subscriptions(subscriptions, old_dataset):
    """
    Updates a list of query subscriptions.

    :param subscriptions: The subscriptions we're updating
    :param snuba_query: A `SnubaQuery` instance to subscribe the project to.
    :return: A list of QuerySubscriptions
    """
    updated_subscriptions = []
    # TODO: Batch this up properly once we care about multi-project rules.
    for subscription in subscriptions:
        updated_subscriptions.append(update_snuba_subscription(subscription, old_dataset))
    return subscriptions


def update_snuba_subscription(subscription, old_dataset):
    """
    Updates a subscription to a snuba query.

    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param old_dataset: The `QueryDataset` that this subscription was associated with
    before the update.
    :return: The QuerySubscription representing the subscription
    """
    with transaction.atomic():
        subscription.update(status=QuerySubscription.Status.UPDATING.value)

        update_subscription_in_snuba.apply_async(
            kwargs={"query_subscription_id": subscription.id, "old_dataset": old_dataset.value},
            countdown=5,
        )

    return subscription


def bulk_delete_snuba_subscriptions(subscriptions):
    """
    Deletes a list of snuba query subscriptions.
    :param subscriptions: The subscriptions to delete
    :return:
    """
    for subscription in subscriptions:
        # TODO: Batch this up properly once we care about multi-project rules.
        delete_snuba_subscription(subscription)


def delete_snuba_subscription(subscription):
    """
    Deletes a subscription to a snuba query.
    :param subscription: The subscription to delete
    :return:
    """
    subscription.update(status=QuerySubscription.Status.DELETING.value)

    delete_subscription_from_snuba.apply_async(
        kwargs={"query_subscription_id": subscription.id}, countdown=5
    )


def bulk_disable_snuba_subscriptions(subscriptions):
    """
    Disables a list of snuba query subscriptions.
    :param subscriptions: The subscriptions to disable
    :return:
    """
    for subscription in subscriptions:
        # TODO: Batch this up properly once we care about multi-project rules.
        disable_snuba_subscription(subscription)


def disable_snuba_subscription(subscription):
    """
    Disables a subscription to a snuba query.
    :param subscription: The subscription to disable
    :return:
    """
    subscription.update(status=QuerySubscription.Status.DISABLED.value)

    delete_subscription_from_snuba.apply_async(
        kwargs={"query_subscription_id": subscription.id}, countdown=5
    )


def bulk_enable_snuba_subscriptions(subscriptions):
    """
    enables a list of snuba query subscriptions.
    :param subscriptions: The subscriptions to enable
    :return:
    """
    for subscription in subscriptions:
        # TODO: Batch this up properly once we care about multi-project rules.
        enable_snuba_subscription(subscription)


def enable_snuba_subscription(subscription):
    """
    enables a subscription to a snuba query.
    :param subscription: The subscription to enable
    :return:
    """
    subscription.update(status=QuerySubscription.Status.CREATING.value)
    create_subscription_in_snuba.apply_async(
        kwargs={"query_subscription_id": subscription.id}, countdown=5
    )
