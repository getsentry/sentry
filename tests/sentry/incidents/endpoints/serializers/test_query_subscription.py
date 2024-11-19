from sentry.api.serializers import serialize
from sentry.snuba.models import QuerySubscription, SnubaQuery
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
            "aggregate": "count()",
            "timeWindow": 60,
            "environment": self.environment.name,
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
            },
        }
