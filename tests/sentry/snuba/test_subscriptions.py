from datetime import timedelta

import pytest

from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import (
    bulk_delete_snuba_subscriptions,
    create_snuba_query,
    create_snuba_subscription,
    delete_snuba_subscription,
    update_snuba_query,
    update_snuba_subscription,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_kafka, requires_snuba

pytestmark = [pytest.mark.sentry_metrics, requires_snuba, requires_kafka]


@pytest.mark.snuba_ci
class CreateSnubaQueryTest(TestCase):
    def test(self):
        query_type = SnubaQuery.Type.ERROR
        dataset = Dataset.Events
        query = "level:error"
        aggregate = "count()"
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        snuba_query = create_snuba_query(
            query_type, dataset, query, aggregate, time_window, resolution, None
        )
        assert snuba_query.type == query_type.value
        assert snuba_query.dataset == dataset.value
        assert snuba_query.query == query
        assert snuba_query.aggregate == aggregate
        assert snuba_query.time_window == int(time_window.total_seconds())
        assert snuba_query.resolution == int(resolution.total_seconds())
        assert snuba_query.environment is None
        assert set(snuba_query.event_types) == {SnubaQueryEventType.EventType.ERROR}

    def test_environment(self):
        query_type = SnubaQuery.Type.ERROR
        dataset = Dataset.Events
        query = "level:error"
        aggregate = "count()"
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        snuba_query = create_snuba_query(
            query_type, dataset, query, aggregate, time_window, resolution, self.environment
        )
        assert snuba_query.type == query_type.value
        assert snuba_query.dataset == dataset.value
        assert snuba_query.query == query
        assert snuba_query.aggregate == aggregate
        assert snuba_query.time_window == int(time_window.total_seconds())
        assert snuba_query.resolution == int(resolution.total_seconds())
        assert snuba_query.environment == self.environment
        assert set(snuba_query.event_types) == {SnubaQueryEventType.EventType.ERROR}

    def test_event_types(self):
        query_type = SnubaQuery.Type.ERROR
        dataset = Dataset.Events
        query = "level:error"
        aggregate = "count()"
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        snuba_query = create_snuba_query(
            query_type,
            dataset,
            query,
            aggregate,
            time_window,
            resolution,
            None,
            [SnubaQueryEventType.EventType.DEFAULT],
        )
        assert snuba_query.type == query_type.value
        assert snuba_query.dataset == dataset.value
        assert snuba_query.query == query
        assert snuba_query.aggregate == aggregate
        assert snuba_query.time_window == int(time_window.total_seconds())
        assert snuba_query.resolution == int(resolution.total_seconds())
        assert snuba_query.environment is None
        assert set(snuba_query.event_types) == {SnubaQueryEventType.EventType.DEFAULT}

    def test_event_types_metrics(self):
        query_type = SnubaQuery.Type.CRASH_RATE
        dataset = Dataset.Metrics
        query = ""
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)

        snuba_query = create_snuba_query(
            query_type,
            dataset,
            query,
            aggregate,
            time_window,
            resolution,
            None,
        )
        assert snuba_query.type == query_type.value
        assert snuba_query.dataset == dataset.value
        assert snuba_query.query == query
        assert snuba_query.aggregate == aggregate
        assert snuba_query.time_window == int(time_window.total_seconds())
        assert snuba_query.resolution == int(resolution.total_seconds())
        assert snuba_query.environment is None
        assert snuba_query.event_types == []


class CreateSnubaSubscriptionTest(TestCase):
    def test(self):
        query_type = SnubaQuery.Type.ERROR
        type = "something"
        dataset = Dataset.Events
        query = "level:error"
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        snuba_query = create_snuba_query(
            query_type, dataset, query, "count()", time_window, resolution, self.environment
        )
        subscription = create_snuba_subscription(self.project, type, snuba_query)
        subscription_with_query_extra = create_snuba_subscription(
            self.project, type, snuba_query, query_extra="foo:bar"
        )

        assert subscription.status == QuerySubscription.Status.CREATING.value
        assert subscription.project == self.project
        assert subscription.type == type
        assert subscription.subscription_id is None
        assert subscription_with_query_extra.query_extra == "foo:bar"

    def test_with_task(self):
        with self.tasks():
            type = "something"
            query_type = SnubaQuery.Type.ERROR
            dataset = Dataset.Events
            query = "level:error"
            time_window = timedelta(minutes=10)
            resolution = timedelta(minutes=1)
            snuba_query = create_snuba_query(
                query_type, dataset, query, "count()", time_window, resolution, self.environment
            )
            subscription = create_snuba_subscription(self.project, type, snuba_query)
            subscription = QuerySubscription.objects.get(id=subscription.id)
            assert subscription.status == QuerySubscription.Status.ACTIVE.value
            assert subscription.project == self.project
            assert subscription.type == type
            assert subscription.subscription_id is not None

    def test_translated_query(self):
        type = "something"
        query_type = SnubaQuery.Type.ERROR
        dataset = Dataset.Events
        query = "event.type:error"
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        with self.tasks():
            snuba_query = create_snuba_query(
                query_type, dataset, query, "count()", time_window, resolution, self.environment
            )
            subscription = create_snuba_subscription(self.project, type, snuba_query)
        subscription = QuerySubscription.objects.get(id=subscription.id)
        assert subscription.status == QuerySubscription.Status.ACTIVE.value
        assert subscription.project == self.project
        assert subscription.type == type
        assert subscription.subscription_id is not None


class UpdateSnubaQueryTest(TestCase):
    def test(self):
        snuba_query = create_snuba_query(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "hello",
            "count_unique(tags[sentry:user])",
            timedelta(minutes=100),
            timedelta(minutes=2),
            self.environment,
            [SnubaQueryEventType.EventType.ERROR],
        )
        query_type = SnubaQuery.Type.PERFORMANCE
        dataset = Dataset.Transactions
        query = "level:error"
        aggregate = "count()"
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        event_types = [SnubaQueryEventType.EventType.ERROR, SnubaQueryEventType.EventType.DEFAULT]
        update_snuba_query(
            snuba_query,
            query_type,
            dataset,
            query,
            aggregate,
            time_window,
            resolution,
            None,
            event_types,
        )
        assert snuba_query.type == query_type.value
        assert snuba_query.dataset == dataset.value
        assert snuba_query.query == query
        assert snuba_query.aggregate == aggregate
        assert snuba_query.time_window == int(time_window.total_seconds())
        assert snuba_query.resolution == int(resolution.total_seconds())
        assert snuba_query.environment is None
        assert set(snuba_query.event_types) == set(event_types)

        event_types = [SnubaQueryEventType.EventType.DEFAULT]
        update_snuba_query(
            snuba_query,
            query_type,
            dataset,
            query,
            aggregate,
            time_window,
            resolution,
            None,
            event_types,
        )
        assert set(snuba_query.event_types) == set(event_types)

    def test_environment(self):
        snuba_query = create_snuba_query(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "hello",
            "count_unique(tags[sentry:user])",
            timedelta(minutes=100),
            timedelta(minutes=2),
            self.environment,
        )

        new_env = self.create_environment()
        query_type = SnubaQuery.Type.PERFORMANCE
        dataset = Dataset.Transactions
        query = "level:error"
        aggregate = "count()"
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        event_types = snuba_query.event_types
        update_snuba_query(
            snuba_query,
            query_type,
            dataset,
            query,
            aggregate,
            time_window,
            resolution,
            new_env,
            None,
        )
        assert snuba_query.type == query_type.value
        assert snuba_query.dataset == dataset.value
        assert snuba_query.query == query
        assert snuba_query.aggregate == aggregate
        assert snuba_query.time_window == int(time_window.total_seconds())
        assert snuba_query.resolution == int(resolution.total_seconds())
        assert snuba_query.environment == new_env
        assert set(snuba_query.event_types) == set(event_types)

    def test_subscriptions(self):
        snuba_query = create_snuba_query(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "hello",
            "count_unique(tags[sentry:user])",
            timedelta(minutes=100),
            timedelta(minutes=2),
            self.environment,
        )
        sub = create_snuba_subscription(self.project, "hi", snuba_query)

        new_env = self.create_environment()
        query_type = SnubaQuery.Type.PERFORMANCE
        dataset = Dataset.Transactions
        query = "level:error"
        aggregate = "count()"
        time_window = timedelta(minutes=10)
        resolution = timedelta(minutes=1)
        update_snuba_query(
            snuba_query,
            query_type,
            dataset,
            query,
            aggregate,
            time_window,
            resolution,
            new_env,
            None,
        )
        sub.refresh_from_db()
        assert sub.snuba_query == snuba_query
        assert sub.status == QuerySubscription.Status.UPDATING.value


class UpdateSnubaSubscriptionTest(TestCase):
    def test(self):
        old_dataset = Dataset.Events
        old_query = "level:error"
        old_aggregate = "count()"
        with self.tasks():
            snuba_query = create_snuba_query(
                SnubaQuery.Type.ERROR,
                old_dataset,
                old_query,
                old_aggregate,
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            subscription = create_snuba_subscription(self.project, "something", snuba_query)
        old_type = SnubaQuery.Type(snuba_query.type)

        dataset = Dataset.Transactions
        query = "level:warning"
        aggregate = "count_unique(tags[sentry:user])"
        time_window = timedelta(minutes=20)
        resolution = timedelta(minutes=2)
        subscription = QuerySubscription.objects.get(id=subscription.id)
        subscription_id = subscription.subscription_id
        snuba_query.update(
            type=SnubaQuery.Type.PERFORMANCE.value,
            dataset=dataset.value,
            query=query,
            time_window=int(time_window.total_seconds()),
            resolution=int(resolution.total_seconds()),
            environment=self.environment,
            aggregate=aggregate,
        )
        assert subscription_id is not None
        update_snuba_subscription(subscription, old_type, old_dataset, old_aggregate, old_query)
        assert subscription.status == QuerySubscription.Status.UPDATING.value
        assert subscription.subscription_id == subscription_id
        assert subscription.snuba_query.dataset == dataset.value
        assert subscription.snuba_query.query == query
        assert subscription.snuba_query.aggregate == aggregate
        assert subscription.snuba_query.time_window == int(time_window.total_seconds())
        assert subscription.snuba_query.resolution == int(resolution.total_seconds())

    def test_with_task(self):
        with self.tasks():
            old_dataset = Dataset.Events
            old_query = "level:error"
            old_aggregate = "count()"
            snuba_query = create_snuba_query(
                SnubaQuery.Type.ERROR,
                old_dataset,
                old_query,
                old_aggregate,
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            subscription = create_snuba_subscription(self.project, "something", snuba_query)
            old_type = SnubaQuery.Type(snuba_query.type)

            dataset = Dataset.Transactions
            query = "level:warning"
            aggregate = "count_unique(tags[sentry:user])"
            time_window = timedelta(minutes=20)
            resolution = timedelta(minutes=2)
            subscription = QuerySubscription.objects.get(id=subscription.id)
            subscription_id = subscription.subscription_id
            assert subscription_id is not None
            snuba_query.update(
                type=SnubaQuery.Type.PERFORMANCE.value,
                dataset=dataset.value,
                query=query,
                time_window=int(time_window.total_seconds()),
                resolution=int(resolution.total_seconds()),
                environment=self.environment,
                aggregate=aggregate,
            )
            update_snuba_subscription(subscription, old_type, old_dataset, old_aggregate, old_query)
            subscription = QuerySubscription.objects.get(id=subscription.id)
            assert subscription.status == QuerySubscription.Status.ACTIVE.value
            assert subscription.subscription_id is not None
            assert subscription.subscription_id != subscription_id

    def test_perf_metric_to_transaction(self):
        with self.tasks():
            old_dataset = Dataset.PerformanceMetrics
            old_query = ""
            old_aggregate = "count()"
            snuba_query = create_snuba_query(
                SnubaQuery.Type.PERFORMANCE,
                old_dataset,
                old_query,
                old_aggregate,
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            subscription = create_snuba_subscription(self.project, "something", snuba_query)
            old_type = SnubaQuery.Type(snuba_query.type)

            dataset = Dataset.Transactions
            query = "level:warning"
            aggregate = "count()"
            time_window = timedelta(minutes=20)
            resolution = timedelta(minutes=2)
            subscription = QuerySubscription.objects.get(id=subscription.id)
            subscription_id = subscription.subscription_id
            assert subscription_id is not None
            snuba_query.update(
                type=SnubaQuery.Type.PERFORMANCE.value,
                dataset=dataset.value,
                query=query,
                time_window=int(time_window.total_seconds()),
                resolution=int(resolution.total_seconds()),
                environment=self.environment,
                aggregate=aggregate,
            )
            update_snuba_subscription(subscription, old_type, old_dataset, old_aggregate, old_query)
            subscription = QuerySubscription.objects.get(id=subscription.id)
            assert subscription.status == QuerySubscription.Status.ACTIVE.value
            assert subscription.subscription_id is not None
            assert subscription.subscription_id != subscription_id


class BulkDeleteSnubaSubscriptionTest(TestCase):
    def test(self):
        with self.tasks():
            snuba_query = create_snuba_query(
                SnubaQuery.Type.ERROR,
                Dataset.Events,
                "level:error",
                "count()",
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            subscription = create_snuba_subscription(self.project, "something", snuba_query)
            snuba_query = create_snuba_query(
                SnubaQuery.Type.ERROR,
                Dataset.Events,
                "level:error",
                "count()",
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            other_subscription = create_snuba_subscription(
                self.create_project(organization=self.organization), "something", snuba_query
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
                SnubaQuery.Type.ERROR,
                Dataset.Events,
                "level:error",
                "count()",
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            subscription = create_snuba_subscription(self.project, "something", snuba_query)
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
                SnubaQuery.Type.ERROR,
                Dataset.Events,
                "level:error",
                "count()",
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            subscription = create_snuba_subscription(self.project, "something", snuba_query)
            subscription_id = subscription.id
            delete_snuba_subscription(subscription)
            assert not QuerySubscription.objects.filter(id=subscription_id).exists()
