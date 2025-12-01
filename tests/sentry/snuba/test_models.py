from datetime import timedelta
from unittest import mock

from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    QuerySubscription,
    QuerySubscriptionDataSourceHandler,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase


class SnubaQueryEventTypesTest(TestCase):
    def test(self) -> None:
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
        assert snuba_query.group_by is None


class QuerySubscriptionDataSourceHandlerTest(TestCase):
    def setUp(self) -> None:
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

    def test_bulk_get_query_object(self) -> None:
        result = QuerySubscriptionDataSourceHandler.bulk_get_query_object([self.data_source])
        assert result[self.data_source.id] == self.subscription

    def test_bulk_get_query_object__incorrect_data_source(self) -> None:
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

    def test_get_instance_limit(self) -> None:
        with self.settings(MAX_QUERY_SUBSCRIPTIONS_PER_ORG=42):
            assert QuerySubscriptionDataSourceHandler.get_instance_limit(self.organization) == 42

    def test_get_instance_limit_with_override(self) -> None:
        with self.settings(MAX_QUERY_SUBSCRIPTIONS_PER_ORG=42):
            with self.options(
                {
                    "metric_alerts.extended_max_subscriptions_orgs": [self.organization.id],
                    "metric_alerts.extended_max_subscriptions": 100,
                }
            ):
                assert (
                    QuerySubscriptionDataSourceHandler.get_instance_limit(self.organization) == 100
                )

    def test_get_current_instance_count(self) -> None:
        new_org = self.create_organization()
        new_project = self.create_project(organization=new_org)
        new_project2 = self.create_project(organization=new_org)
        # Create some subscriptions in different states
        QuerySubscription.objects.create(
            project=new_project,
            type="active_sub",
            snuba_query=self.snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )
        QuerySubscription.objects.create(
            project=new_project2,
            type="creating_sub",
            snuba_query=self.snuba_query,
            status=QuerySubscription.Status.CREATING.value,
        )
        QuerySubscription.objects.create(
            project=new_project,
            type="updating_sub",
            snuba_query=self.snuba_query,
            status=QuerySubscription.Status.UPDATING.value,
        )
        QuerySubscription.objects.create(
            project=new_project2,
            type="disabled_sub",
            snuba_query=self.snuba_query,
            status=QuerySubscription.Status.DISABLED.value,
        )

        # Should count active, creating, and updating subscriptions
        assert QuerySubscriptionDataSourceHandler.get_current_instance_count(new_org) == 3

        # Create a subscription for a different org
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        QuerySubscription.objects.create(
            project=other_project,
            type="other_org_sub",
            snuba_query=self.snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        # Count should still be 3 as it only counts for the given org
        assert QuerySubscriptionDataSourceHandler.get_current_instance_count(new_org) == 3
