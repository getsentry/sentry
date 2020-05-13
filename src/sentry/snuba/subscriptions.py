from __future__ import absolute_import

import logging

from django.db import transaction

from sentry.snuba.models import (
    QueryAggregations,
    QuerySubscription,
    QuerySubscriptionEnvironment,
    SnubaQuery,
)
from sentry.snuba.tasks import (
    create_subscription_in_snuba,
    delete_subscription_from_snuba,
    update_subscription_in_snuba,
)

logger = logging.getLogger(__name__)

aggregation_function_translations = {
    QueryAggregations.TOTAL: "count()",
    QueryAggregations.UNIQUE_USERS: "count_unique(tags[sentry:user])",
}
aggregate_to_query_aggregation = {
    val: key for key, val in aggregation_function_translations.items()
}


def translate_aggregation(aggregation):
    """
    Temporary function to translate `QueryAggregations` into the discover aggregation
    function format
    :param aggregation:
    :return: A string representing the aggregate function
    """
    return aggregation_function_translations[aggregation]


def create_snuba_query(dataset, query, aggregation, time_window, resolution, environment):
    """
    Creates a SnubaQuery.

    :param dataset: The snuba dataset to query and aggregate over
    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param aggregation: An aggregation to calculate over the time window
    :param time_window: The time window to aggregate over
    :param resolution: How often to receive updates/bucket size
    :param environment: An optional environment to filter by
    :return: A list of QuerySubscriptions
    """
    return SnubaQuery.objects.create(
        dataset=dataset.value,
        query=query,
        aggregate=translate_aggregation(aggregation),
        time_window=int(time_window.total_seconds()),
        resolution=int(resolution.total_seconds()),
        environment=environment,
    )


def update_snuba_query(snuba_query, query, aggregation, time_window, resolution, environment):
    """
    Updates a SnubaQuery. Triggers updates to any related QuerySubscriptions.

    :param snuba_query: The `SnubaQuery` to update.
    :param dataset: The snuba dataset to query and aggregate over
    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param aggregation: An aggregation to calculate over the time window
    :param time_window: The time window to aggregate over
    :param resolution: How often to receive updates/bucket size
    :param environment: An optional environment to filter by
    :return: A list of QuerySubscriptions
    """
    with transaction.atomic():
        query_subscriptions = list(snuba_query.subscriptions.all())
        snuba_query.update(
            query=query,
            aggregate=translate_aggregation(aggregation),
            time_window=int(time_window.total_seconds()),
            resolution=int(resolution.total_seconds()),
            environment=environment,
        )
        bulk_update_snuba_subscriptions(query_subscriptions, snuba_query, aggregation)


def bulk_create_snuba_subscriptions(projects, subscription_type, snuba_query, aggregation):
    """
    Creates a subscription to a snuba query for each project.

    :param projects: The projects we're applying the query to
    :param subscription_type: Text identifier for the subscription type this is. Used
    to identify the registered callback associated with this subscription.
    :param snuba_query: A `SnubaQuery` instance to subscribe the projects to.
    :param aggregation: An aggregation to calculate over the time window. This will be
    removed soon, once we're relying entirely on `snuba_query`.
    :return: A list of QuerySubscriptions
    """
    subscriptions = []
    # TODO: Batch this up properly once we care about multi-project rules.
    for project in projects:
        subscriptions.append(
            create_snuba_subscription(project, subscription_type, snuba_query, aggregation)
        )
    return subscriptions


def create_snuba_subscription(project, subscription_type, snuba_query, aggregation):
    """
    Creates a subscription to a snuba query.

    :param project: The project we're applying the query to
    :param subscription_type: Text identifier for the subscription type this is. Used
    to identify the registered callback associated with this subscription.
    :param snuba_query: A `SnubaQuery` instance to subscribe the project to.
    :param aggregation: An aggregation to calculate over the time window. This will be
    removed soon, once we're relying entirely on `snuba_query`.
    :return: The QuerySubscription representing the subscription
    """
    subscription = QuerySubscription.objects.create(
        status=QuerySubscription.Status.CREATING.value,
        project=project,
        snuba_query=snuba_query,
        type=subscription_type,
        dataset=snuba_query.dataset,
        query=snuba_query.query,
        aggregation=aggregation.value,
        time_window=snuba_query.time_window,
        resolution=snuba_query.resolution,
    )
    if snuba_query.environment:
        QuerySubscriptionEnvironment.objects.create(
            query_subscription=subscription, environment=snuba_query.environment
        )

    create_subscription_in_snuba.apply_async(
        kwargs={"query_subscription_id": subscription.id}, countdown=5
    )

    return subscription


def bulk_update_snuba_subscriptions(subscriptions, snuba_query, aggregation):
    """
    Updates a list of query subscriptions.

    :param subscriptions: The subscriptions we're updating
    :param snuba_query: A `SnubaQuery` instance to subscribe the project to.
    :param aggregation: An aggregation to calculate over the time window. This will be
    removed soon, once we're relying entirely on `snuba_query`.
    :return: A list of QuerySubscriptions
    """
    updated_subscriptions = []
    # TODO: Batch this up properly once we care about multi-project rules.
    for subscription in subscriptions:
        updated_subscriptions.append(
            update_snuba_subscription(subscription, snuba_query, aggregation)
        )
    return subscriptions


def update_snuba_subscription(subscription, snuba_query, aggregation):
    """
    Updates a subscription to a snuba query.

    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param snuba_query: A `SnubaQuery` instance to subscribe the project to.
    :param aggregation: An aggregation to calculate over the time window. This will be
    removed soon, once we're relying entirely on `snuba_query`.
    :return: The QuerySubscription representing the subscription
    """
    with transaction.atomic():
        subscription.update(
            status=QuerySubscription.Status.UPDATING.value,
            query=snuba_query.query,
            aggregation=aggregation.value,
            time_window=snuba_query.time_window,
            resolution=snuba_query.resolution,
        )
        QuerySubscriptionEnvironment.objects.filter(query_subscription=subscription).exclude(
            environment=snuba_query.environment
        ).delete()
        if snuba_query.environment:
            QuerySubscriptionEnvironment.objects.get_or_create(
                query_subscription=subscription, environment=snuba_query.environment
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
