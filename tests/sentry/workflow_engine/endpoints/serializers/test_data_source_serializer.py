from typing import int
from datetime import timedelta

from sentry.api.serializers import serialize
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscriptionDataSourceHandler, SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.registry import data_source_type_registry

pytestmark = [requires_snuba]


class TestDataSourceSerializer(TestCase):
    def test_serialize(self) -> None:
        snuba_query = create_snuba_query(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "hello",
            "count()",
            timedelta(minutes=1),
            timedelta(minutes=1),
            None,
        )
        type_name = data_source_type_registry.get_key(QuerySubscriptionDataSourceHandler)
        subscription = create_snuba_subscription(
            self.project, INCIDENTS_SNUBA_SUBSCRIPTION_TYPE, snuba_query
        )

        data_source = self.create_data_source(
            organization=self.organization,
            type=type_name,
            source_id=str(subscription.id),
        )

        result = serialize(data_source)

        assert result == {
            "id": str(data_source.id),
            "organizationId": str(self.organization.id),
            "type": type_name,
            "sourceId": str(subscription.id),
            "queryObj": {
                "id": str(subscription.id),
                "snubaQuery": {
                    "aggregate": "count()",
                    "dataset": "events",
                    "environment": None,
                    "id": str(snuba_query.id),
                    "query": "hello",
                    "timeWindow": 60,
                    "eventTypes": ["error"],
                    "extrapolationMode": "unknown",
                },
                "status": 1,
                "subscription": None,
            },
        }
