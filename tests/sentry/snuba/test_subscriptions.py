from __future__ import absolute_import

from datetime import timedelta

from sentry.snuba.models import QueryAggregations, QueryDatasets, QuerySubscription
from sentry.snuba.subscriptions import (
    aggregation_function_translations,
    bulk_delete_snuba_subscriptions,
    create_snuba_query,
    create_snuba_subscription,
    delete_snuba_subscription,
    translate_aggregation,
    update_snuba_query,
    update_snuba_subscription,
)
from sentry.testutils import TestCase


class CreateSnubaQueryTest(TestCase):
    def test(self):
        dataset = QueryDatasets.EVENTS
        query = "level:error"
        aggregation = QueryAggregations.TOTAL
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        snuba_query = create_snuba_query(dataset, query, aggregation, time_window, resolution, None)
        assert snuba_query.dataset == dataset.value
        assert snuba_query.query == query
        assert snuba_query.aggregate == translate_aggregation(aggregation)
        assert snuba_query.time_window == int(time_window.total_seconds())
        assert snuba_query.resolution == int(resolution.total_seconds())
        assert snuba_query.environment is None

    def test_environment(self):
        dataset = QueryDatasets.EVENTS
        query = "level:error"
        aggregation = QueryAggregations.TOTAL
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        snuba_query = create_snuba_query(
            dataset, query, aggregation, time_window, resolution, self.environment
        )
        assert snuba_query.dataset == dataset.value
        assert snuba_query.query == query
        assert snuba_query.aggregate == translate_aggregation(aggregation)
        assert snuba_query.time_window == int(time_window.total_seconds())
        assert snuba_query.resolution == int(resolution.total_seconds())
        assert snuba_query.environment == self.environment


class CreateSnubaSubscriptionTest(TestCase):
    def test(self):
        type = "something"
        dataset = QueryDatasets.EVENTS
        query = "level:error"
        aggregation = QueryAggregations.TOTAL
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        snuba_query = create_snuba_query(
            dataset, query, aggregation, time_window, resolution, self.environment
        )
        subscription = create_snuba_subscription(self.project, type, snuba_query, aggregation)

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
            snuba_query = create_snuba_query(
                dataset, query, aggregation, time_window, resolution, self.environment
            )
            subscription = create_snuba_subscription(self.project, type, snuba_query, aggregation)
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
        with self.tasks():
            snuba_query = create_snuba_query(
                dataset, query, aggregation, time_window, resolution, self.environment
            )
            subscription = create_snuba_subscription(self.project, type, snuba_query, aggregation)
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


class UpdateSnubaQueryTest(TestCase):
    def test(self):
        dataset = QueryDatasets.EVENTS
        snuba_query = create_snuba_query(
            dataset,
            "hello",
            QueryAggregations.UNIQUE_USERS,
            timedelta(minutes=100),
            timedelta(minutes=2),
            self.environment,
        )
        query = "level:error"
        aggregation = QueryAggregations.TOTAL
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        update_snuba_query(snuba_query, query, aggregation, time_window, resolution, None)
        assert snuba_query.dataset == dataset.value
        assert snuba_query.query == query
        assert snuba_query.aggregate == translate_aggregation(aggregation)
        assert snuba_query.time_window == int(time_window.total_seconds())
        assert snuba_query.resolution == int(resolution.total_seconds())
        assert snuba_query.environment is None

    def test_environment(self):
        dataset = QueryDatasets.EVENTS
        snuba_query = create_snuba_query(
            dataset,
            "hello",
            QueryAggregations.UNIQUE_USERS,
            timedelta(minutes=100),
            timedelta(minutes=2),
            self.environment,
        )

        new_env = self.create_environment()
        query = "level:error"
        aggregation = QueryAggregations.TOTAL
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        update_snuba_query(snuba_query, query, aggregation, time_window, resolution, new_env)
        assert snuba_query.dataset == dataset.value
        assert snuba_query.query == query
        assert snuba_query.aggregate == translate_aggregation(aggregation)
        assert snuba_query.time_window == int(time_window.total_seconds())
        assert snuba_query.resolution == int(resolution.total_seconds())
        assert snuba_query.environment == new_env

    def test_subscriptions(self):
        dataset = QueryDatasets.EVENTS
        snuba_query = create_snuba_query(
            dataset,
            "hello",
            QueryAggregations.UNIQUE_USERS,
            timedelta(minutes=100),
            timedelta(minutes=2),
            self.environment,
        )
        sub = create_snuba_subscription(self.project, "hi", snuba_query, QueryAggregations.TOTAL)

        new_env = self.create_environment()
        query = "level:error"
        aggregation = QueryAggregations.TOTAL
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        update_snuba_query(snuba_query, query, aggregation, time_window, resolution, new_env)
        sub.refresh_from_db()
        assert sub.snuba_query == snuba_query
        assert sub.query == query
        assert sub.time_window == int(time_window.total_seconds())
        assert sub.resolution == int(resolution.total_seconds())


class UpdateSnubaSubscriptionTest(TestCase):
    def test(self):
        with self.tasks():
            snuba_query = create_snuba_query(
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            subscription = create_snuba_subscription(
                self.project, "something", snuba_query, QueryAggregations.TOTAL
            )

        query = "level:warning"
        aggregation = QueryAggregations.UNIQUE_USERS
        time_window = timedelta(minutes=20)
        resolution = timedelta(minutes=2)
        subscription = QuerySubscription.objects.get(id=subscription.id)
        subscription_id = subscription.subscription_id
        snuba_query.update(
            query=query,
            time_window=int(time_window.total_seconds()),
            resolution=int(resolution.total_seconds()),
            environment=self.environment,
            aggregate=aggregation_function_translations[aggregation],
        )
        assert subscription_id is not None
        update_snuba_subscription(subscription, snuba_query, aggregation)
        assert subscription.status == QuerySubscription.Status.UPDATING.value
        assert subscription.subscription_id == subscription_id
        assert subscription.snuba_query.query == query
        assert subscription.query == query
        assert subscription.snuba_query.aggregate == aggregation_function_translations[aggregation]
        assert subscription.aggregation == aggregation.value
        assert subscription.snuba_query.time_window == int(time_window.total_seconds())
        assert subscription.time_window == int(time_window.total_seconds())
        assert subscription.snuba_query.resolution == int(resolution.total_seconds())
        assert subscription.resolution == int(resolution.total_seconds())

    def test_with_task(self):
        with self.tasks():
            snuba_query = create_snuba_query(
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            subscription = create_snuba_subscription(
                self.project, "something", snuba_query, QueryAggregations.TOTAL
            )

            query = "level:warning"
            aggregation = QueryAggregations.UNIQUE_USERS
            time_window = timedelta(minutes=20)
            resolution = timedelta(minutes=2)
            subscription = QuerySubscription.objects.get(id=subscription.id)
            subscription_id = subscription.subscription_id
            assert subscription_id is not None
            snuba_query.update(
                query=query,
                time_window=int(time_window.total_seconds()),
                resolution=int(resolution.total_seconds()),
                environment=self.environment,
            )
            update_snuba_subscription(subscription, snuba_query, aggregation)
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
            snuba_query = create_snuba_query(
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            subscription = create_snuba_subscription(
                self.project, "something", snuba_query, QueryAggregations.TOTAL
            )
            snuba_query = create_snuba_query(
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            other_subscription = create_snuba_subscription(
                self.create_project(organization=self.organization),
                "something",
                snuba_query,
                QueryAggregations.TOTAL,
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
            snuba_query = create_snuba_query(
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            subscription = create_snuba_subscription(
                self.project, "something", snuba_query, QueryAggregations.TOTAL
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
            snuba_query = create_snuba_query(
                QueryDatasets.EVENTS,
                "level:error",
                QueryAggregations.TOTAL,
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            subscription = create_snuba_subscription(
                self.project, "something", snuba_query, QueryAggregations.TOTAL
            )
            subscription_id = subscription.id
            delete_snuba_subscription(subscription)
            assert not QuerySubscription.objects.filter(id=subscription_id).exists()
