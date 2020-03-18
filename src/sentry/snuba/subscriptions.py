from __future__ import absolute_import

import logging

from sentry.snuba.models import QuerySubscription, QuerySubscriptionEnvironment
from sentry.snuba.tasks import (
    create_subscription_in_snuba,
    delete_subscription_from_snuba,
    update_subscription_in_snuba,
)

logger = logging.getLogger(__name__)


def bulk_create_snuba_subscriptions(
    projects, subscription_type, dataset, query, aggregation, time_window, resolution, environments
):
    """
    Creates a subscription to a snuba query for each project.

    :param projects: The projects we're applying the query to
    :param subscription_type: Text identifier for the subscription type this is. Used
    to identify the registered callback associated with this subscription.
    :param dataset: The snuba dataset to query and aggregate over
    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param aggregation: An aggregation to calculate over the time window
    :param time_window: The time window to aggregate over
    :param resolution: How often to receive updates/bucket size
    :param environments: List of environments to filter by
    :return: A list of QuerySubscriptions
    """
    subscriptions = []
    # TODO: Batch this up properly once we care about multi-project rules.
    for project in projects:
        subscriptions.append(
            create_snuba_subscription(
                project,
                subscription_type,
                dataset,
                query,
                aggregation,
                time_window,
                resolution,
                environments,
            )
        )
    return subscriptions


def create_snuba_subscription(
    project, subscription_type, dataset, query, aggregation, time_window, resolution, environments
):
    """
    Creates a subscription to a snuba query.

    :param project: The project we're applying the query to
    :param subscription_type: Text identifier for the subscription type this is. Used
    to identify the registered callback associated with this subscription.
    :param dataset: The snuba dataset to query and aggregate over
    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param aggregation: An aggregation to calculate over the time window
    :param time_window: The time window to aggregate over
    :param resolution: How often to receive updates/bucket size
    :param environments: List of environments to filter by
    :return: The QuerySubscription representing the subscription
    """
    subscription = QuerySubscription.objects.create(
        status=QuerySubscription.Status.CREATING.value,
        project=project,
        type=subscription_type,
        dataset=dataset.value,
        query=query,
        aggregation=aggregation.value,
        time_window=int(time_window.total_seconds()),
        resolution=int(resolution.total_seconds()),
    )
    sub_envs = [
        QuerySubscriptionEnvironment(query_subscription=subscription, environment=env)
        for env in environments
    ]
    QuerySubscriptionEnvironment.objects.bulk_create(sub_envs)

    create_subscription_in_snuba.apply_async(
        kwargs={"query_subscription_id": subscription.id}, countdown=5
    )

    return subscription


def bulk_update_snuba_subscriptions(
    subscriptions, query, aggregation, time_window, resolution, environments
):
    """
    Updates a list of query subscriptions.

    :param subscriptions: The subscriptions we're updating
    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param aggregation: An aggregation to calculate over the time window
    :param time_window: The time window to aggregate over
    :param resolution: How often to receive updates/bucket size
    :param environments: List of environments to filter by
    :return: A list of QuerySubscriptions
    """
    updated_subscriptions = []
    # TODO: Batch this up properly once we care about multi-project rules.
    for subscription in subscriptions:
        updated_subscriptions.append(
            update_snuba_subscription(
                subscription, query, aggregation, time_window, resolution, environments
            )
        )
    return subscriptions


def update_snuba_subscription(
    subscription, query, aggregation, time_window, resolution, environments
):
    """
    Updates a subscription to a snuba query.

    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param aggregation: An aggregation to calculate over the time window
    :param time_window: The time window to aggregate over
    :param resolution: How often to receive updates/bucket size
    :param environments: List of environments to filter by
    :return: The QuerySubscription representing the subscription
    """
    subscription.update(
        status=QuerySubscription.Status.UPDATING.value,
        query=query,
        aggregation=aggregation.value,
        time_window=int(time_window.total_seconds()),
        resolution=int(resolution.total_seconds()),
    )
    QuerySubscriptionEnvironment.objects.filter(query_subscription=subscription).exclude(
        environment__in=environments
    ).delete()
    for e in environments:
        QuerySubscriptionEnvironment.objects.get_or_create(
            query_subscription=subscription, environment=e
        )

    update_subscription_in_snuba.apply_async(
        kwargs={"query_subscription_id": subscription.id}, countdown=5
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
