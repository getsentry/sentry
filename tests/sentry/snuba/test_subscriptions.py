from __future__ import absolute_import

from datetime import timedelta

from sentry.snuba.models import QueryAggregations, QueryDatasets, QuerySubscription
from sentry.snuba.subscriptions import (
    bulk_delete_snuba_subscriptions,
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
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        subscription = create_snuba_subscription(
            self.project, type, dataset, query, aggregation, time_window, resolution, []
        )
        assert subscription.status == QuerySubscription.Status.CREATING.value
        assert subscription.project == self.project
        assert subscription.type == type
        assert subscription.subscription_id is None
        assert subscription.dataset == dataset.value
        assert subscription.query == query
        assert subscription.aggregation == aggregation.value
        assert subscription.time_window == int(time_window.total_seconds())
        assert subscription.resolution == int(resolution.total_seconds())

    def test_with_task(self):
        with self.tasks():
            type = "something"
            dataset = QueryDatasets.EVENTS
            query = "level:error"
            aggregation = QueryAggregations.TOTAL
            time_window = timedelta(minutes=10)
            resolution = timedelta(minutes=1)
            subscription = create_snuba_subscription(
                self.project, type, dataset, query, aggregation, time_window, resolution, []
            )
            subscription = QuerySubscription.objects.get(id=subscription.id)
            assert subscription.status == QuerySubscription.Status.ACTIVE.value
            assert subscription.project == self.project
            assert subscription.type == type
            assert subscription.subscription_id is not None
            assert subscription.dataset == dataset.value
            assert subscription.query == query
            assert subscription.aggregation == aggregation.value
            assert subscription.time_window == int(time_window.total_seconds())
            assert subscription.resolution == int(resolution.total_seconds())

    def test_translated_query(self):
        type = "something"
        dataset = QueryDatasets.EVENTS
        query = "event.type:error"
        aggregation = QueryAggregations.TOTAL
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        subscription = create_snuba_subscription(
            self.project, type, dataset, query, aggregation, time_window, resolution, []
        )
        assert subscription.status == QuerySubscription.Status.CREATING.value
        assert subscription.project == self.project
        assert subscription.type == type
        assert subscription.subscription_id is None
        assert subscription.dataset == dataset.value
        assert subscription.query == query
        assert subscription.aggregation == aggregation.value
        assert subscription.time_window == int(time_window.total_seconds())
        assert subscription.resolution == int(resolution.total_seconds())


class UpdateSnubaSubscriptionTest(TestCase):
    def test(self):
        with self.tasks():
            subscription = create_snuba_subscription(
                self.project,
                "something",
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                [],
            )

        query = "level:warning"
        aggregation = QueryAggregations.UNIQUE_USERS
        time_window = timedelta(minutes=20)
        resolution = timedelta(minutes=2)
        subscription = QuerySubscription.objects.get(id=subscription.id)
        subscription_id = subscription.subscription_id
        assert subscription_id is not None
        update_snuba_subscription(subscription, query, aggregation, time_window, resolution, [])
        assert subscription.status == QuerySubscription.Status.UPDATING.value
        assert subscription.subscription_id == subscription_id
        assert subscription.query == query
        assert subscription.aggregation == aggregation.value
        assert subscription.time_window == int(time_window.total_seconds())
        assert subscription.resolution == int(resolution.total_seconds())

    def test_with_task(self):
        with self.tasks():
            subscription = create_snuba_subscription(
                self.project,
                "something",
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                [],
            )

            query = "level:warning"
            aggregation = QueryAggregations.UNIQUE_USERS
            time_window = timedelta(minutes=20)
            resolution = timedelta(minutes=2)
            subscription = QuerySubscription.objects.get(id=subscription.id)
            subscription_id = subscription.subscription_id
            assert subscription_id is not None
            update_snuba_subscription(subscription, query, aggregation, time_window, resolution, [])
            subscription = QuerySubscription.objects.get(id=subscription.id)
            assert subscription.status == QuerySubscription.Status.ACTIVE.value
            assert subscription.subscription_id is not None
            assert subscription.subscription_id != subscription_id
            assert subscription.query == query
            assert subscription.aggregation == aggregation.value
            assert subscription.time_window == int(time_window.total_seconds())
            assert subscription.resolution == int(resolution.total_seconds())


class BulkDeleteSnubaSubscriptionTest(TestCase):
    def test(self):
        with self.tasks():
            subscription = create_snuba_subscription(
                self.project,
                "something",
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                [],
            )
            other_subscription = create_snuba_subscription(
                self.create_project(organization=self.organization),
                "something",
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                [],
            )
        subscription_ids = [subscription.id, other_subscription.id]
        bulk_delete_snuba_subscriptions([subscription, other_subscription])
        assert (
            QuerySubscription.objects.filter(
                id__in=subscription_ids,
                status=QuerySubscription.Status.DELETING.value,
                subscription_id__isnull=False,
            ).count()
            == 2
        )


class DeleteSnubaSubscriptionTest(TestCase):
    def test(self):
        with self.tasks():
            subscription = create_snuba_subscription(
                self.project,
                "something",
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                [],
            )
        # Refetch since snuba creation happens in a task
        subscription = QuerySubscription.objects.get(id=subscription.id)
        subscription_id = subscription.subscription_id
        assert subscription_id is not None
        delete_snuba_subscription(subscription)
        assert subscription.status == QuerySubscription.Status.DELETING.value
        assert subscription.subscription_id == subscription_id

    def test_with_task(self):
        with self.tasks():
            subscription = create_snuba_subscription(
                self.project,
                "something",
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                [],
            )
            subscription_id = subscription.id
            delete_snuba_subscription(subscription)
            assert not QuerySubscription.objects.filter(id=subscription_id).exists()
