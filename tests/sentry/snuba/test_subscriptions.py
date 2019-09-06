from __future__ import absolute_import

from sentry.snuba.models import QueryAggregations, QueryDatasets, QuerySubscription
from sentry.snuba.subscriptions import (
    create_snuba_subscription,
    delete_snuba_subscription,
    update_snuba_subscription,
)
from sentry.testutils import TestCase


class CreateSnubaSubscriptionTest(TestCase):
    def test(self):
        type = "something"
        dataset = QueryDatasets.EVENTS
        query = "level:error"
        aggregation = QueryAggregations.TOTAL
        time_window = 10
        resolution = 1
        subscription = create_snuba_subscription(
            self.project, type, dataset, query, aggregation, time_window, resolution
        )
        assert subscription.project == self.project
        assert subscription.type == type
        assert subscription.subscription_id != ""
        assert subscription.dataset == dataset.value
        assert subscription.query == query
        assert subscription.aggregation == aggregation.value
        assert subscription.time_window == time_window
        assert subscription.resolution == resolution


class UpdateSnubaSubscriptionTest(TestCase):
    def test(self):
        subscription = create_snuba_subscription(
            self.project,
            "something",
            QueryDatasets.EVENTS,
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1,
        )

        query = "level:warning"
        aggregation = QueryAggregations.UNIQUE_USERS
        time_window = 20
        resolution = 2
        old_subscription_id = subscription.subscription_id
        update_snuba_subscription(subscription, query, aggregation, time_window, resolution)
        assert subscription.subscription_id != old_subscription_id
        assert subscription.query == query
        assert subscription.aggregation == aggregation.value
        assert subscription.time_window == time_window
        assert subscription.resolution == resolution


class DeleteSnubaSubscriptionTest(TestCase):
    def test(self):
        subscription = create_snuba_subscription(
            self.project,
            "something",
            QueryDatasets.EVENTS,
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1,
        )
        subscription_id = subscription.id
        delete_snuba_subscription(subscription)
        assert not QuerySubscription.objects.filter(id=subscription_id).exists()
