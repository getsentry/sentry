from __future__ import absolute_import

import json

from django.db import transaction

from sentry.api.event_search import get_filter
from sentry.snuba.models import QueryAggregations, QueryDatasets, QuerySubscription
from sentry.utils.snuba import _snuba_pool, SnubaError

query_aggregation_to_snuba = {
    QueryAggregations.TOTAL: ("count()", "", "count"),
    QueryAggregations.UNIQUE_USERS: ("uniq", "tags[sentry:user]", "unique_users"),
}


def bulk_create_snuba_subscriptions(
    projects, subscription_type, dataset, query, aggregation, time_window, resolution
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
    :return: A list of QuerySubscriptions
    """
    subscriptions = []
    # TODO: Batch this up properly once we move to tasks.
    for project in projects:
        subscriptions.append(
            create_snuba_subscription(
                project, subscription_type, dataset, query, aggregation, time_window, resolution
            )
        )
    return subscriptions


def create_snuba_subscription(
    project, subscription_type, dataset, query, aggregation, time_window, resolution
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
    :return: The QuerySubscription representing the subscription
    """
    # TODO: Move this call to snuba into a task. This lets us successfully create a
    # subscription in postgres and rollback as needed without having to create/delete
    # from Snuba
    subscription_id = _create_in_snuba(
        project, dataset, query, aggregation, time_window, resolution
    )

    return QuerySubscription.objects.create(
        project=project,
        type=subscription_type,
        subscription_id=subscription_id,
        dataset=dataset.value,
        query=query,
        aggregation=aggregation.value,
        time_window=time_window,
        resolution=resolution,
    )


def bulk_update_snuba_subscriptions(subscriptions, query, aggregation, time_window, resolution):
    """
    Updates a list of query subscriptions.

    :param subscriptions: The subscriptions we're updating
    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param aggregation: An aggregation to calculate over the time window
    :param time_window: The time window to aggregate over
    :param resolution: How often to receive updates/bucket size
    :return: A list of QuerySubscriptions
    """
    updated_subscriptions = []
    # TODO: Batch this up properly once we move to tasks.
    for subscription in subscriptions:
        updated_subscriptions.append(
            update_snuba_subscription(subscription, query, aggregation, time_window, resolution)
        )
    return subscriptions


def update_snuba_subscription(subscription, query, aggregation, time_window, resolution):
    """
    Updates a subscription to a snuba query.

    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param aggregation: An aggregation to calculate over the time window
    :param time_window: The time window to aggregate over
    :param resolution: How often to receive updates/bucket size
    :return: The QuerySubscription representing the subscription
    """
    # TODO: Move this call to snuba into a task. This lets us successfully update a
    # subscription in postgres and rollback as needed without having to create/delete
    # from snuba
    _delete_from_snuba(subscription)
    subscription_id = _create_in_snuba(
        subscription.project,
        QueryDatasets(subscription.dataset),
        query,
        aggregation,
        time_window,
        resolution,
    )
    subscription.update(
        subscription_id=subscription_id,
        query=query,
        aggregation=aggregation.value,
        time_window=time_window,
        resolution=resolution,
    )
    return subscription


def bulk_delete_snuba_subscriptions(subscriptions):
    """
    Deletes a list of snuba query subscriptions.
    :param subscriptions: The subscriptions to delete
    :return:
    """
    for subscription in subscriptions:
        # TODO: Batch this up properly once we move to tasks.
        delete_snuba_subscription(subscription)


def delete_snuba_subscription(subscription):
    """
    Deletes a subscription to a snuba query.
    :param subscription: The subscription to delete
    :return:
    """
    with transaction.atomic():
        subscription.delete()
        # TODO: Move this call to snuba into a task. This lets us successfully delete a
        # subscription in postgres and rollback as needed without having to create/delete
        # from snuba
        _delete_from_snuba(subscription)


def _create_in_snuba(project, dataset, query, aggregation, time_window, resolution):
    response = _snuba_pool.urlopen(
        "POST",
        "/subscriptions",
        body=json.dumps(
            {
                "project_id": project.id,
                "dataset": dataset.value,
                # We only care about conditions here. Filter keys only matter for
                # filtering to project and groups. Projects are handled with an
                # explicit param, and groups can't be queried here.
                "conditions": get_filter(query).conditions,
                "aggregates": [query_aggregation_to_snuba[aggregation]],
                "time_window": time_window,
                "resolution": resolution,
            }
        ),
        retries=False,
    )
    if response.status != 202:
        raise SnubaError("HTTP %s response from Snuba!" % response.status)
    return json.loads(response.data)["subscription_id"]


def _delete_from_snuba(subscription):
    response = _snuba_pool.urlopen(
        "DELETE", "/subscriptions/%s" % subscription.subscription_id, retries=False
    )
    if response.status != 202:
        raise SnubaError("HTTP %s response from Snuba!" % response.status)
