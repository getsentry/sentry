from sentry.api.serializers import serialize
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.testutils.cases import TestCase


class TestSnubaQuerySerializer(TestCase):
    def test_serialize(self):
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            query="test query",
            aggregate="count()",
            time_window=60,
            resolution=60,
            environment=self.environment,
        )
        result = serialize(snuba_query)

        assert result == {
            "id": str(snuba_query.id),
            "dataset": "events",
            "query": "test query",
            "eventTypes": [],
            "aggregate": "count()",
            "timeWindow": 60,
            "environment": self.environment.name,
        }

    def test_serialize_with_event_types(self):
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            query="test query",
            aggregate="count()",
            time_window=60,
            resolution=60,
            environment=self.environment,
        )

        SnubaQueryEventType.objects.create(
            snuba_query=snuba_query,
            type=SnubaQueryEventType.EventType.ERROR.value,
        )

        SnubaQueryEventType.objects.create(
            snuba_query=snuba_query,
            type=SnubaQueryEventType.EventType.DEFAULT.value,
        )

        SnubaQueryEventType.objects.create(
            snuba_query=snuba_query,
            type=SnubaQueryEventType.EventType.TRANSACTION.value,
        )

        result = serialize(snuba_query)

        assert result == {
            "id": str(snuba_query.id),
            "dataset": "events",
            "query": "test query",
            "aggregate": "count()",
            "timeWindow": 60,
            "environment": self.environment.name,
            "eventTypes": [
                SnubaQueryEventType.EventType.ERROR.name.lower(),
                SnubaQueryEventType.EventType.DEFAULT.name.lower(),
                SnubaQueryEventType.EventType.TRANSACTION.name.lower(),
            ],
        }

    def test_serialize_no_environment(self):
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            query="test query",
            aggregate="count()",
            time_window=60,
            resolution=60,
        )

        result = serialize(snuba_query)

        assert result == {
            "id": str(snuba_query.id),
            "dataset": "events",
            "query": "test query",
            "aggregate": "count()",
            "timeWindow": 60,
            "environment": None,
            "eventTypes": [],
        }


class TestQuerySubscriptionSerializer(TestCase):
    def test_serialize(self):
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            query="test query",
            aggregate="count()",
            time_window=60,
            resolution=60,
        )
        subscription = QuerySubscription.objects.create(
            project=self.project,
            status=QuerySubscription.Status.ACTIVE.value,
            subscription_id="123",
            snuba_query=snuba_query,
        )

        result = serialize(subscription)

        assert result == {
            "id": str(subscription.id),
            "status": QuerySubscription.Status.ACTIVE.value,
            "subscription": "123",
            "snubaQuery": {
                "id": str(snuba_query.id),
                "dataset": "events",
                "query": "test query",
                "aggregate": "count()",
                "timeWindow": 60,
                "environment": None,
                "eventTypes": [],
            },
        }
