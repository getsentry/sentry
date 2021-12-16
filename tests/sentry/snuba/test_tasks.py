import abc
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
import responses
from django.utils import timezone
from exam import patcher

from sentry.release_health.metrics import get_tag_values_list, metric_id, tag_key, tag_value
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.sessions import SessionMetricKey
from sentry.snuba.entity_subscription import (
    apply_dataset_query_conditions,
    get_entity_subscription_for_dataset,
)
from sentry.snuba.models import QueryDatasets, QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.tasks import (
    SUBSCRIPTION_STATUS_MAX_AGE,
    build_snuba_filter,
    create_subscription_in_snuba,
    delete_subscription_from_snuba,
    subscription_checker,
    update_subscription_in_snuba,
)
from sentry.testutils import TestCase
from sentry.utils import json
from sentry.utils.snuba import _snuba_pool


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

    def create_subscription(self, status=None, subscription_id=None, dataset=None, query=None):
        if status is None:
            status = self.expected_status
        if dataset is None:
            dataset = QueryDatasets.EVENTS
        dataset = dataset.value
        aggregate = "count_unique(tags[sentry:user])"
        if query is None:
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
        self.metrics.incr.assert_any_call("snuba.subscriptions.create.already_created_in_snuba")

    def test(self):
        sub = self.create_subscription(QuerySubscription.Status.CREATING)
        create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    def test_group_id(self):
        group_id = 1234
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING, query=f"issue.id:{group_id}"
        )
        with patch.object(_snuba_pool, "urlopen", side_effect=_snuba_pool.urlopen) as urlopen:
            create_subscription_in_snuba(sub.id)
            assert ["group_id", "IN", [group_id]] in json.loads(urlopen.call_args[1]["body"])[
                "conditions"
            ]
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
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.EVENTS,
            aggregate="count_unique(user)",
        )
        snuba_filter = build_snuba_filter(entity_subscription, "", environment=None)
        assert snuba_filter
        assert snuba_filter.conditions == [["type", "=", "error"]]
        assert snuba_filter.aggregations == [["uniq", "tags[sentry:user]", "count_unique_user"]]

    def test_simple_transactions(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.TRANSACTIONS, aggregate="count_unique(user)"
        )
        snuba_filter = build_snuba_filter(entity_subscription, "", environment=None)
        assert snuba_filter
        assert snuba_filter.conditions == []
        assert snuba_filter.aggregations == [["uniq", "user", "count_unique_user"]]

    def test_simple_sessions(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.SESSIONS,
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            extra_fields={"org_id": self.organization.id},
        )
        snuba_filter = build_snuba_filter(
            entity_subscription,
            query="",
            environment=None,
        )
        assert snuba_filter
        assert snuba_filter.aggregations == [
            [
                "if(greater(sessions,0),divide(sessions_crashed,sessions),null)",
                None,
                "_crash_rate_alert_aggregate",
            ],
            ["identity", "sessions", "_total_count"],
        ]

    def test_simple_users(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.SESSIONS,
            aggregate="percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
            extra_fields={"org_id": self.organization.id},
        )
        snuba_filter = build_snuba_filter(
            entity_subscription,
            query="",
            environment=None,
        )
        assert snuba_filter
        assert snuba_filter.aggregations == [
            [
                "if(greater(users,0),divide(users_crashed,users),null)",
                None,
                "_crash_rate_alert_aggregate",
            ],
            ["identity", "users", "_total_count"],
        ]

    def test_simple_sessions_for_metrics(self):
        for tag in [SessionMetricKey.SESSION.value, "session.status", "crashed", "init"]:
            indexer.record(tag)
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.METRICS,
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            extra_fields={"org_id": self.organization.id},
        )
        snuba_filter = build_snuba_filter(
            entity_subscription,
            query="",
            environment=None,
        )
        org_id = self.organization.id
        session_status = tag_key(org_id, "session.status")
        session_status_tag_values = get_tag_values_list(org_id, ["crashed", "init"])
        assert snuba_filter
        assert snuba_filter.aggregations == [["sum(value)", None, "value"]]
        assert snuba_filter.conditions == [
            ["metric_id", "=", metric_id(org_id, SessionMetricKey.SESSION)],
            [session_status, "IN", session_status_tag_values],
        ]
        assert snuba_filter.groupby == [session_status]

    def test_aliased_query_events(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.EVENTS,
            aggregate="count_unique(user)",
        )
        snuba_filter = build_snuba_filter(entity_subscription, "release:latest", environment=None)
        assert snuba_filter
        assert snuba_filter.conditions == [
            ["type", "=", "error"],
            ["tags[sentry:release]", "=", "latest"],
        ]
        assert snuba_filter.aggregations == [["uniq", "tags[sentry:user]", "count_unique_user"]]

    def test_query_and_environment_sessions(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.SESSIONS,
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            extra_fields={"org_id": self.organization.id},
        )
        env = self.create_environment(self.project, name="development")
        snuba_filter = build_snuba_filter(
            entity_subscription,
            query="release:ahmed@12.2",
            environment=env,
        )
        assert snuba_filter
        assert snuba_filter.aggregations == [
            [
                "if(greater(sessions,0),divide(sessions_crashed,sessions),null)",
                None,
                "_crash_rate_alert_aggregate",
            ],
            ["identity", "sessions", "_total_count"],
        ]
        assert snuba_filter.conditions == [
            ["release", "=", "ahmed@12.2"],
            ["environment", "=", "development"],
        ]

    def test_query_and_environment_metrics(self):
        env = self.create_environment(self.project, name="development")
        for tag in [
            SessionMetricKey.SESSION.value,
            "session.status",
            "environment",
            "development",
            "init",
            "crashed",
            "release",
            "ahmed@12.2",
        ]:
            indexer.record(tag)
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.METRICS,
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            extra_fields={"org_id": self.organization.id},
        )
        snuba_filter = build_snuba_filter(
            entity_subscription,
            query="release:ahmed@12.2",
            environment=env,
        )
        org_id = self.organization.id
        assert snuba_filter
        assert snuba_filter.aggregations == [["sum(value)", None, "value"]]
        assert snuba_filter.groupby == [tag_key(org_id, "session.status")]
        assert snuba_filter.conditions == [
            ["metric_id", "=", metric_id(org_id, SessionMetricKey.SESSION)],
            [
                tag_key(org_id, "session.status"),
                "IN",
                get_tag_values_list(org_id, ["crashed", "init"]),
            ],
            [tag_key(org_id, "environment"), "=", tag_value(org_id, "development")],
            [tag_key(org_id, "release"), "=", tag_value(org_id, "ahmed@12.2")],
        ]

    def test_query_and_environment_users(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.SESSIONS,
            aggregate="percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
            extra_fields={"org_id": self.organization.id},
        )
        env = self.create_environment(self.project, name="development")
        snuba_filter = build_snuba_filter(
            entity_subscription,
            query="release:ahmed@12.2",
            environment=env,
        )
        assert snuba_filter
        assert snuba_filter.aggregations == [
            [
                "if(greater(users,0),divide(users_crashed,users),null)",
                None,
                "_crash_rate_alert_aggregate",
            ],
            ["identity", "users", "_total_count"],
        ]
        assert snuba_filter.conditions == [
            ["release", "=", "ahmed@12.2"],
            ["environment", "=", "development"],
        ]

    def test_aliased_query_transactions(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.TRANSACTIONS,
            aggregate="percentile(transaction.duration,.95)",
        )
        snuba_filter = build_snuba_filter(
            entity_subscription,
            "release:latest",
            environment=None,
        )
        assert snuba_filter
        assert snuba_filter.conditions == [["release", "=", "latest"]]
        assert snuba_filter.aggregations == [
            ["quantile(0.95)", "duration", "percentile_transaction_duration__95"]
        ]

    def test_user_query(self):
        entity_subscription = get_entity_subscription_for_dataset(
            QueryDatasets.EVENTS, aggregate="count()"
        )
        snuba_filter = build_snuba_filter(
            entity_subscription, query="user:anengineer@work.io", environment=None
        )
        assert snuba_filter
        assert snuba_filter.conditions == [
            ["type", "=", "error"],
            ["tags[sentry:user]", "=", "anengineer@work.io"],
        ]
        assert snuba_filter.aggregations == [["count", None, "count"]]

    def test_user_query_transactions(self):
        entity_subscription = get_entity_subscription_for_dataset(
            QueryDatasets.TRANSACTIONS, aggregate="p95()"
        )
        snuba_filter = build_snuba_filter(
            entity_subscription, query="user:anengineer@work.io", environment=None
        )
        assert snuba_filter
        assert snuba_filter.conditions == [["user", "=", "anengineer@work.io"]]
        assert snuba_filter.aggregations == [["quantile(0.95)", "duration", "p95"]]

    def test_boolean_query(self):
        entity_subscription = get_entity_subscription_for_dataset(
            QueryDatasets.EVENTS, aggregate="count_unique(user)"
        )
        snuba_filter = build_snuba_filter(
            entity_subscription, query="release:latest OR release:123", environment=None
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
        entity_subscription = get_entity_subscription_for_dataset(
            QueryDatasets.EVENTS,
            aggregate="count_unique(user)",
            extra_fields={
                "event_types": [
                    SnubaQueryEventType.EventType.ERROR,
                    SnubaQueryEventType.EventType.DEFAULT,
                ]
            },
        )
        snuba_filter = build_snuba_filter(
            entity_subscription=entity_subscription,
            query="release:latest OR release:123",
            environment=None,
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
        assert (
            apply_dataset_query_conditions(
                QueryDatasets.SESSIONS,
                "release:123",
                [],
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
            sub_new = self.create_subscription(status, date_updated=timezone.now())
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
