import abc
from uuid import uuid4

import pytest
import responses
from django.utils import timezone
from exam import patcher
from sentry.utils.compat.mock import Mock, patch

from sentry.snuba.models import QueryDatasets, QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.tasks import (
    apply_dataset_query_conditions,
    build_snuba_filter,
    create_subscription_in_snuba,
    delete_subscription_from_snuba,
    update_subscription_in_snuba,
    subscription_checker,
    SUBSCRIPTION_STATUS_MAX_AGE,
)
from sentry.utils import json
from sentry.testutils import TestCase


class BaseSnubaTaskTest(metaclass=abc.ABCMeta):
    metrics = patcher("sentry.snuba.tasks.metrics")

    status_translations = {
        QuerySubscription.Status.CREATING: "create",
        QuerySubscription.Status.UPDATING: "update",
        QuerySubscription.Status.DELETING: "delete",
    }

    @abc.abstractproperty
    def expected_status(self):
        pass

    @abc.abstractmethod
    def task(self):
        pass

    def create_subscription(self, status=None, subscription_id=None, dataset=None):
        if status is None:
            status = self.expected_status
        if dataset is None:
            dataset = QueryDatasets.EVENTS
        dataset = dataset.value
        aggregate = "count_unique(tags[sentry:user])"
        query = "hello"
        time_window = 60
        resolution = 60

        snuba_query = SnubaQuery.objects.create(
            dataset=dataset,
            aggregate=aggregate,
            query=query,
            time_window=time_window,
            resolution=resolution,
        )
        return QuerySubscription.objects.create(
            snuba_query=snuba_query,
            status=status.value,
            subscription_id=subscription_id,
            project=self.project,
            type="something",
        )

    def test_no_subscription(self):
        self.task(12345)
        self.metrics.incr.assert_called_once_with(
            "snuba.subscriptions.{}.subscription_does_not_exist".format(
                self.status_translations[self.expected_status]
            )
        )

    def test_invalid_status(self):
        sub = self.create_subscription(QuerySubscription.Status.ACTIVE)
        self.task(sub.id)
        self.metrics.incr.assert_called_once_with(
            "snuba.subscriptions.{}.incorrect_status".format(
                self.status_translations[self.expected_status]
            )
        )


class CreateSubscriptionInSnubaTest(BaseSnubaTaskTest, TestCase):
    expected_status = QuerySubscription.Status.CREATING
    task = create_subscription_in_snuba

    def test_already_created(self):
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING, subscription_id=uuid4().hex
        )
        create_subscription_in_snuba(sub.id)
        self.metrics.incr.assert_called_once_with(
            "snuba.subscriptions.create.already_created_in_snuba"
        )

    def test(self):
        sub = self.create_subscription(QuerySubscription.Status.CREATING)
        create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    def test_transaction(self):
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING, dataset=QueryDatasets.TRANSACTIONS
        )
        create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    @responses.activate
    def test_adds_type(self):
        sub = self.create_subscription(QuerySubscription.Status.CREATING)
        with patch("sentry.snuba.tasks._snuba_pool") as pool:
            resp = Mock()
            resp.status = 202
            resp.data = json.dumps({"subscription_id": "123"})
            pool.urlopen.return_value = resp

            create_subscription_in_snuba(sub.id)
            request_body = json.loads(pool.urlopen.call_args[1]["body"])
            assert ["type", "=", "error"] in request_body["conditions"]


class UpdateSubscriptionInSnubaTest(BaseSnubaTaskTest, TestCase):
    expected_status = QuerySubscription.Status.UPDATING
    task = update_subscription_in_snuba

    def test(self):
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.UPDATING, subscription_id=subscription_id
        )
        update_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None
        assert sub.subscription_id != subscription_id

    def test_no_subscription_id(self):
        sub = self.create_subscription(QuerySubscription.Status.UPDATING)
        assert sub.subscription_id is None
        update_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None


class DeleteSubscriptionFromSnubaTest(BaseSnubaTaskTest, TestCase):
    expected_status = QuerySubscription.Status.DELETING
    task = delete_subscription_from_snuba

    def test(self):
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DELETING, subscription_id=subscription_id
        )
        delete_subscription_from_snuba(sub.id)
        assert not QuerySubscription.objects.filter(id=sub.id).exists()

    def test_no_subscription_id(self):
        sub = self.create_subscription(QuerySubscription.Status.DELETING)
        assert sub.subscription_id is None
        delete_subscription_from_snuba(sub.id)
        assert not QuerySubscription.objects.filter(id=sub.id).exists()


class BuildSnubaFilterTest(TestCase):
    def test_simple_events(self):
        snuba_filter = build_snuba_filter(
            QueryDatasets.EVENTS, "", "count_unique(user)", None, None
        )
        assert snuba_filter
        assert snuba_filter.conditions == [["type", "=", "error"]]
        assert snuba_filter.aggregations == [["uniq", "tags[sentry:user]", "count_unique_user"]]

    def test_simple_transactions(self):
        snuba_filter = build_snuba_filter(
            QueryDatasets.TRANSACTIONS, "", "count_unique(user)", None, None
        )
        assert snuba_filter
        assert snuba_filter.conditions == []
        assert snuba_filter.aggregations == [["uniq", "user", "count_unique_user"]]

    def test_aliased_query_events(self):
        snuba_filter = build_snuba_filter(
            QueryDatasets.EVENTS, "release:latest", "count_unique(user)", None, None
        )
        assert snuba_filter
        assert snuba_filter.conditions == [
            ["type", "=", "error"],
            ["tags[sentry:release]", "=", "latest"],
        ]
        assert snuba_filter.aggregations == [["uniq", "tags[sentry:user]", "count_unique_user"]]

    def test_aliased_query_transactions(self):
        snuba_filter = build_snuba_filter(
            QueryDatasets.TRANSACTIONS,
            "release:latest",
            "percentile(transaction.duration,.95)",
            None,
            None,
        )
        assert snuba_filter
        assert snuba_filter.conditions == [["release", "=", "latest"]]
        assert snuba_filter.aggregations == [
            ["quantile(0.95)", "duration", "percentile_transaction_duration__95"]
        ]

    def test_user_query(self):
        snuba_filter = build_snuba_filter(
            QueryDatasets.EVENTS, "user:anengineer@work.io", "count()", None, None
        )
        assert snuba_filter
        assert snuba_filter.conditions == [
            ["type", "=", "error"],
            ["tags[sentry:user]", "=", "anengineer@work.io"],
        ]
        assert snuba_filter.aggregations == [["count", None, "count"]]

    def test_user_query_transactions(self):
        snuba_filter = build_snuba_filter(
            QueryDatasets.TRANSACTIONS, "user:anengineer@work.io", "p95()", None, None
        )
        assert snuba_filter
        assert snuba_filter.conditions == [["user", "=", "anengineer@work.io"]]
        assert snuba_filter.aggregations == [["quantile(0.95)", "duration", "p95"]]

    def test_boolean_query(self):
        snuba_filter = build_snuba_filter(
            QueryDatasets.EVENTS, "release:latest OR release:123", "count_unique(user)", None, None
        )
        assert snuba_filter
        assert snuba_filter.conditions == [
            ["type", "=", "error"],
            [
                [
                    "or",
                    [
                        ["equals", ["tags[sentry:release]", "'latest'"]],
                        ["equals", ["tags[sentry:release]", "'123'"]],
                    ],
                ],
                "=",
                1,
            ],
        ]
        assert snuba_filter.aggregations == [["uniq", "tags[sentry:user]", "count_unique_user"]]

    def test_event_types(self):
        snuba_filter = build_snuba_filter(
            QueryDatasets.EVENTS,
            "release:latest OR release:123",
            "count_unique(user)",
            None,
            [SnubaQueryEventType.EventType.ERROR, SnubaQueryEventType.EventType.DEFAULT],
        )
        assert snuba_filter
        assert snuba_filter.conditions == [
            [["or", [["equals", ["type", "'error'"]], ["equals", ["type", "'default'"]]]], "=", 1],
            [
                [
                    "or",
                    [
                        ["equals", ["tags[sentry:release]", "'latest'"]],
                        ["equals", ["tags[sentry:release]", "'123'"]],
                    ],
                ],
                "=",
                1,
            ],
        ]
        assert snuba_filter.aggregations == [["uniq", "tags[sentry:user]", "count_unique_user"]]


class TestApplyDatasetQueryConditions(TestCase):
    def test_no_event_types_no_discover(self):
        assert (
            apply_dataset_query_conditions(QueryDatasets.EVENTS, "release:123", None, False)
            == "(event.type:error) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                QueryDatasets.EVENTS, "release:123 OR release:456", None, False
            )
            == "(event.type:error) AND (release:123 OR release:456)"
        )
        assert (
            apply_dataset_query_conditions(QueryDatasets.TRANSACTIONS, "release:123", None, False)
            == "release:123"
        )
        assert (
            apply_dataset_query_conditions(
                QueryDatasets.TRANSACTIONS, "release:123 OR release:456", None, False
            )
            == "release:123 OR release:456"
        )

    def test_no_event_types_discover(self):
        assert (
            apply_dataset_query_conditions(QueryDatasets.EVENTS, "release:123", None, True)
            == "(event.type:error) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                QueryDatasets.EVENTS, "release:123 OR release:456", None, True
            )
            == "(event.type:error) AND (release:123 OR release:456)"
        )
        assert (
            apply_dataset_query_conditions(QueryDatasets.TRANSACTIONS, "release:123", None, True)
            == "(event.type:transaction) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                QueryDatasets.TRANSACTIONS, "release:123 OR release:456", None, True
            )
            == "(event.type:transaction) AND (release:123 OR release:456)"
        )

    def test_event_types_no_discover(self):
        assert (
            apply_dataset_query_conditions(
                QueryDatasets.EVENTS, "release:123", [SnubaQueryEventType.EventType.ERROR], False
            )
            == "(event.type:error) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                QueryDatasets.EVENTS,
                "release:123",
                [SnubaQueryEventType.EventType.ERROR, SnubaQueryEventType.EventType.DEFAULT],
                False,
            )
            == "(event.type:error OR event.type:default) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                QueryDatasets.TRANSACTIONS,
                "release:123",
                [SnubaQueryEventType.EventType.TRANSACTION],
                False,
            )
            == "release:123"
        )

    def test_event_types_discover(self):
        assert (
            apply_dataset_query_conditions(
                QueryDatasets.EVENTS, "release:123", [SnubaQueryEventType.EventType.ERROR], True
            )
            == "(event.type:error) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                QueryDatasets.EVENTS,
                "release:123",
                [SnubaQueryEventType.EventType.ERROR, SnubaQueryEventType.EventType.DEFAULT],
                True,
            )
            == "(event.type:error OR event.type:default) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                QueryDatasets.TRANSACTIONS,
                "release:123",
                [SnubaQueryEventType.EventType.TRANSACTION],
                True,
            )
            == "(event.type:transaction) AND (release:123)"
        )


class SubscriptionCheckerTest(TestCase):
    def create_subscription(self, status, subscription_id=None, date_updated=None):
        dataset = QueryDatasets.EVENTS.value
        aggregate = "count_unique(tags[sentry:user])"
        query = "hello"
        time_window = 60
        resolution = 60

        snuba_query = SnubaQuery.objects.create(
            dataset=dataset,
            aggregate=aggregate,
            query=query,
            time_window=time_window,
            resolution=resolution,
        )
        sub = QuerySubscription.objects.create(
            snuba_query=snuba_query,
            status=status.value,
            subscription_id=subscription_id,
            project=self.project,
            type="something",
        )
        if date_updated:
            QuerySubscription.objects.filter(id=sub.id).update(date_updated=date_updated)
        return sub

    def test_create_update(self):
        for status in (
            QuerySubscription.Status.CREATING,
            QuerySubscription.Status.UPDATING,
            QuerySubscription.Status.DELETING,
        ):
            sub = self.create_subscription(
                status,
                date_updated=timezone.now() - SUBSCRIPTION_STATUS_MAX_AGE * 2,
            )
            sub_new = self.create_subscription(
                status,
                date_updated=timezone.now(),
            )
            with self.tasks():
                subscription_checker()
            if status == QuerySubscription.Status.DELETING:
                with pytest.raises(QuerySubscription.DoesNotExist):
                    QuerySubscription.objects.get(id=sub.id)
                sub_new = QuerySubscription.objects.get(id=sub_new.id)
                assert sub_new.status == status.value
                assert sub_new.subscription_id is None
            else:
                sub = QuerySubscription.objects.get(id=sub.id)
                assert sub.status == QuerySubscription.Status.ACTIVE.value
                assert sub.subscription_id is not None
                sub_new = QuerySubscription.objects.get(id=sub_new.id)
                assert sub_new.status == status.value
                assert sub_new.subscription_id is None
