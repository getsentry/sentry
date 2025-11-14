from typing import int
from sentry.api.serializers import serialize
from sentry.snuba.models import (
    ExtrapolationMode,
    QuerySubscription,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.testutils.cases import TestCase


class TestSnubaQuerySerializer(TestCase):
    def test_serialize(self) -> None:
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
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.ERROR.value
        )

        result = serialize(snuba_query)

        assert result == {
            "id": str(snuba_query.id),
            "dataset": "events",
            "query": "test query",
            "aggregate": "count()",
            "timeWindow": 60,
            "environment": self.environment.name,
            "eventTypes": ["error"],
            "extrapolationMode": "unknown",
        }

    def test_serialize_no_environment(self) -> None:
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            query="test query",
            aggregate="count()",
            time_window=60,
            resolution=60,
        )
        SnubaQueryEventType.objects.create(
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.ERROR.value
        )

        result = serialize(snuba_query)

        assert result == {
            "id": str(snuba_query.id),
            "dataset": "events",
            "query": "test query",
            "aggregate": "count()",
            "timeWindow": 60,
            "environment": None,
            "eventTypes": ["error"],
            "extrapolationMode": "unknown",
        }

    def test_serialize_with_extrapolation_mode(self) -> None:
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="spans",
            query="test query",
            aggregate="count()",
            time_window=60,
            resolution=60,
            extrapolation_mode=ExtrapolationMode.SERVER_WEIGHTED.value,
        )
        SnubaQueryEventType.objects.create(
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value
        )

        result = serialize(snuba_query)

        assert result == {
            "id": str(snuba_query.id),
            "dataset": "spans",
            "query": "test query",
            "aggregate": "count()",
            "timeWindow": 60,
            "environment": None,
            "eventTypes": ["trace_item_span"],
            "extrapolationMode": "server_weighted",
        }


class TestQuerySubscriptionSerializer(TestCase):
    def test_serialize(self) -> None:
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            query="test query",
            aggregate="count()",
            time_window=60,
            resolution=60,
        )
        SnubaQueryEventType.objects.create(
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.ERROR.value
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
                "eventTypes": ["error"],
                "extrapolationMode": "unknown",
            },
        }
