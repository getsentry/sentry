from datetime import timedelta
from unittest import mock

from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscriptionDataSourceHandler, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase


class SnubaQueryEventTypesTest(TestCase):
    def test(self):
        snuba_query = create_snuba_query(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "release:123",
            "count()",
            timedelta(minutes=10),
            timedelta(minutes=1),
            None,
            [SnubaQueryEventType.EventType.DEFAULT, SnubaQueryEventType.EventType.ERROR],
        )
        assert set(snuba_query.event_types) == {
            SnubaQueryEventType.EventType.DEFAULT,
            SnubaQueryEventType.EventType.ERROR,
        }


class QuerySubscriptionDataSourceHandlerTest(TestCase):
    def setUp(self):
        self.snuba_query = create_snuba_query(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "release:123",
            "count()",
            timedelta(minutes=10),
            timedelta(minutes=1),
            None,
            [SnubaQueryEventType.EventType.DEFAULT, SnubaQueryEventType.EventType.ERROR],
        )

        self.subscription = create_snuba_subscription(
            self.project,
            "test_data_source_handler",
            self.snuba_query,
        )

        self.data_source = self.create_data_source(
            type="snuba_query_subscription",
            source_id=str(self.subscription.id),
        )

    def test_bulk_get_query_object(self):
        result = QuerySubscriptionDataSourceHandler.bulk_get_query_object([self.data_source])
        assert result[self.data_source.id] == self.subscription

    def test_bulk_get_query_object__incorrect_data_source(self):
        self.ds_with_invalid_subscription_id = self.create_data_source(
            type="snuba_query_subscription",
            source_id="not_int",
        )

        with mock.patch("sentry.snuba.models.logger.exception") as mock_logger:
            data_sources = [self.data_source, self.ds_with_invalid_subscription_id]
            result = QuerySubscriptionDataSourceHandler.bulk_get_query_object(data_sources)
            assert result[self.data_source.id] == self.subscription

            mock_logger.assert_called_once_with(
                "Invalid DataSource.source_id fetching subscriptions",
                extra={
                    "id": self.ds_with_invalid_subscription_id.id,
                    "source_id": self.ds_with_invalid_subscription_id.source_id,
                },
            )
