import abc
from datetime import timedelta
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
import responses
from django.utils import timezone
from exam import patcher
from snuba_sdk import And, Column, Condition, Entity, Function, Op, Or, Query

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.utils import resolve, resolve_many_weak, resolve_tag_key, resolve_weak
from sentry.snuba.entity_subscription import (
    apply_dataset_query_conditions,
    get_entity_subscription_for_dataset,
    map_aggregate_to_entity_key,
)
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.snuba.models import QueryDatasets, QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.tasks import (
    SUBSCRIPTION_STATUS_MAX_AGE,
    build_query_builder,
    build_snuba_filter,
    create_subscription_in_snuba,
    delete_subscription_from_snuba,
    subscription_checker,
    update_subscription_in_snuba,
)
from sentry.testutils import TestCase
from sentry.utils import json
from sentry.utils.snuba import _snuba_pool


def _indexer_record(org_id: int, string: str) -> int:
    return indexer.record(use_case_id=UseCaseKey.RELEASE_HEALTH, org_id=org_id, string=string)


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

    def create_subscription(
        self,
        status=None,
        subscription_id=None,
        dataset=None,
        query=None,
        aggregate=None,
        time_window=None,
    ):
        if status is None:
            status = self.expected_status
        if dataset is None:
            dataset = QueryDatasets.EVENTS
        dataset = dataset.value
        if aggregate is None:
            aggregate = "count_unique(tags[sentry:user])"
        if query is None:
            query = "hello"
        if time_window is None:
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
            request_body = json.loads(urlopen.call_args[1]["body"])
            assert f"group_id = {group_id}" in request_body["query"]
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
            assert "type = 'error'" in request_body["query"]

    @responses.activate
    def test_granularity_on_metrics_crash_rate_alerts(self):
        for tag in [SessionMRI.SESSION.value, SessionMRI.USER.value, "session.status"]:
            _indexer_record(self.organization.id, tag)
        for (time_window, expected_granularity) in [
            (30, 10),
            (90, 60),
            (5 * 60, 3600),
            (25 * 60, 3600 * 24),
        ]:
            for idx, aggregate in enumerate(["sessions", "users"]):
                sub = self.create_subscription(
                    dataset=QueryDatasets.METRICS,
                    aggregate=f"percentage({aggregate}_crashed, {aggregate}) AS "
                    f"_crash_rate_alert_aggregate",
                    time_window=int(timedelta(minutes=time_window).total_seconds()),
                    status=QuerySubscription.Status.CREATING,
                )
                with patch("sentry.snuba.tasks._snuba_pool") as pool:
                    resp = Mock()
                    resp.status = 202
                    resp.data = json.dumps({"subscription_id": "123" + f"{time_window + idx}"})
                    pool.urlopen.return_value = resp

                    create_subscription_in_snuba(sub.id)
                    request_body = json.loads(pool.urlopen.call_args[1]["body"])
                    assert request_body["granularity"] == expected_granularity


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
            time_window=3600,
            aggregate="count_unique(user)",
        )
        snuba_filter = build_snuba_filter(entity_subscription, "", environment=None)
        assert snuba_filter
        assert snuba_filter.conditions == [["type", "=", "error"]]
        assert snuba_filter.aggregations == [["uniq", "tags[sentry:user]", "count_unique_user"]]

    def test_simple_transactions(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.TRANSACTIONS, time_window=3600, aggregate="count_unique(user)"
        )
        snuba_filter = build_snuba_filter(entity_subscription, "", environment=None)
        assert snuba_filter
        assert snuba_filter.conditions == []
        assert snuba_filter.aggregations == [["uniq", "user", "count_unique_user"]]

    def test_simple_sessions(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.SESSIONS,
            time_window=3600,
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
            time_window=3600,
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
        org_id = self.organization.id
        for tag in [SessionMRI.SESSION.value, "session.status", "crashed", "init"]:
            _indexer_record(org_id, tag)
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.METRICS,
            time_window=3600,
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            extra_fields={"org_id": org_id},
        )
        snuba_filter = build_snuba_filter(
            entity_subscription,
            query="",
            environment=None,
        )
        session_status = resolve_tag_key(org_id, "session.status")
        crashed = resolve(org_id, "crashed")
        init = resolve(org_id, "init")
        assert snuba_filter
        assert snuba_filter.aggregations == [
            [f"sumIf(value, equals({session_status}, {init}))", None, "count"],
            [f"sumIf(value, equals({session_status}, {crashed}))", None, "crashed"],
        ]
        assert snuba_filter.conditions == [
            ["metric_id", "=", resolve(org_id, SessionMRI.SESSION.value)],
            [session_status, "IN", [crashed, init]],
        ]
        assert snuba_filter.groupby is None

    def test_simple_users_for_metrics(self):
        org_id = self.organization.id
        for tag in [SessionMRI.USER.value, "session.status", "crashed"]:
            _indexer_record(org_id, tag)
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.METRICS,
            time_window=3600,
            aggregate="percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
            extra_fields={"org_id": org_id},
        )
        snuba_filter = build_snuba_filter(
            entity_subscription,
            query="",
            environment=None,
        )
        session_status = resolve_tag_key(org_id, "session.status")
        crashed = resolve(org_id, "crashed")
        assert snuba_filter
        assert snuba_filter.aggregations == [
            ["uniq(value)", None, "count"],
            [f"uniqIf(value, equals({session_status}, {crashed}))", None, "crashed"],
        ]
        assert snuba_filter.conditions == [
            ["metric_id", "=", resolve(org_id, SessionMRI.USER.value)],
        ]
        assert snuba_filter.groupby is None

    def test_aliased_query_events(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.EVENTS,
            aggregate="count_unique(user)",
            time_window=3600,
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
            time_window=3600,
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

    def test_query_and_environment_sessions_metrics(self):
        env = self.create_environment(self.project, name="development")
        org_id = self.organization.id
        for tag in [
            SessionMRI.SESSION.value,
            "session.status",
            "environment",
            "development",
            "init",
            "crashed",
            "release",
            "ahmed@12.2",
        ]:
            _indexer_record(org_id, tag)
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.METRICS,
            time_window=3600,
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            extra_fields={"org_id": org_id},
        )
        snuba_filter = build_snuba_filter(
            entity_subscription,
            query="release:ahmed@12.2",
            environment=env,
        )
        assert snuba_filter
        assert snuba_filter.aggregations == [
            [
                f"sumIf(value, equals({resolve_tag_key(org_id, 'session.status')}, {resolve_weak(org_id, 'init')}))",
                None,
                "count",
            ],
            [
                f"sumIf(value, equals({resolve_tag_key(org_id, 'session.status')}, {resolve_weak(org_id, 'crashed')}))",
                None,
                "crashed",
            ],
        ]
        assert snuba_filter.groupby is None
        assert snuba_filter.conditions == [
            ["metric_id", "=", resolve(org_id, SessionMRI.SESSION.value)],
            [
                resolve_tag_key(org_id, "session.status"),
                "IN",
                resolve_many_weak(org_id, ["crashed", "init"]),
            ],
            [resolve_tag_key(org_id, "environment"), "=", resolve_weak(org_id, "development")],
            [resolve_tag_key(org_id, "release"), "=", resolve_weak(org_id, "ahmed@12.2")],
        ]

    def test_query_and_environment_users(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.SESSIONS,
            aggregate="percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
            extra_fields={"org_id": self.organization.id},
            time_window=3600,
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

    def test_query_and_environment_users_metrics(self):
        env = self.create_environment(self.project, name="development")
        org_id = self.organization.id
        for tag in [
            SessionMRI.USER.value,
            "session.status",
            "environment",
            "development",
            "init",
            "crashed",
            "release",
            "ahmed@12.2",
        ]:
            _indexer_record(org_id, tag)
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.METRICS,
            time_window=3600,
            aggregate="percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
            extra_fields={"org_id": org_id},
        )
        snuba_filter = build_snuba_filter(
            entity_subscription,
            query="release:ahmed@12.2",
            environment=env,
        )
        session_status = resolve_tag_key(org_id, "session.status")
        crashed = resolve(org_id, "crashed")
        assert snuba_filter
        assert snuba_filter.aggregations == [
            ["uniq(value)", None, "count"],
            [f"uniqIf(value, equals({session_status}, {crashed}))", None, "crashed"],
        ]
        assert snuba_filter.groupby is None
        assert snuba_filter.conditions == [
            ["metric_id", "=", resolve(org_id, SessionMRI.USER.value)],
            [resolve_tag_key(org_id, "environment"), "=", resolve_weak(org_id, "development")],
            [resolve_tag_key(org_id, "release"), "=", resolve_weak(org_id, "ahmed@12.2")],
        ]

    def test_aliased_query_transactions(self):
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.TRANSACTIONS,
            time_window=3600,
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
            QueryDatasets.EVENTS,
            aggregate="count()",
            time_window=3600,
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
            QueryDatasets.TRANSACTIONS,
            aggregate="p95()",
            time_window=3600,
        )
        snuba_filter = build_snuba_filter(
            entity_subscription, query="user:anengineer@work.io", environment=None
        )
        assert snuba_filter
        assert snuba_filter.conditions == [["user", "=", "anengineer@work.io"]]
        assert snuba_filter.aggregations == [["quantile(0.95)", "duration", "p95"]]

    def test_boolean_query(self):
        entity_subscription = get_entity_subscription_for_dataset(
            QueryDatasets.EVENTS,
            aggregate="count_unique(user)",
            time_window=3600,
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
            time_window=3600,
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


class BuildSnqlQueryTest(TestCase):
    aggregate_mappings = {
        QueryDatasets.EVENTS: {
            "count_unique(user)": lambda org_id: [
                Function(
                    function="uniq",
                    parameters=[Column(name="tags[sentry:user]")],
                    alias="count_unique_user",
                )
            ]
        },
        QueryDatasets.TRANSACTIONS: {
            "count_unique(user)": lambda org_id: [
                Function(
                    function="uniq",
                    parameters=[Column(name="user")],
                    alias="count_unique_user",
                )
            ],
            "percentile(transaction.duration,.95)": lambda org_id: [
                Function(
                    "quantile(0.95)",
                    parameters=[Column(name="duration")],
                    alias="percentile_transaction_duration__95",
                )
            ],
            "p95()": lambda org_id: [
                Function("quantile(0.95)", parameters=[Column(name="duration")], alias="p95")
            ],
        },
        QueryDatasets.SESSIONS: {
            "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate": lambda org_id: [
                Function(
                    function="if",
                    parameters=[
                        Function(function="greater", parameters=[Column(name="sessions"), 0]),
                        Function(
                            function="divide",
                            parameters=[Column(name="sessions_crashed"), Column(name="sessions")],
                        ),
                        None,
                    ],
                    alias="_crash_rate_alert_aggregate",
                )
            ],
            "percentage(users_crashed, users) as _crash_rate_alert_aggregate": lambda org_id: [
                Function(
                    function="if",
                    parameters=[
                        Function(function="greater", parameters=[Column(name="users"), 0]),
                        Function(
                            function="divide",
                            parameters=[Column(name="users_crashed"), Column(name="users")],
                        ),
                        None,
                    ],
                    alias="_crash_rate_alert_aggregate",
                )
            ],
        },
        QueryDatasets.METRICS: {
            "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate": lambda org_id: [
                Function(
                    function="sumIf",
                    parameters=[
                        Column(name="value"),
                        Function(
                            function="equals",
                            parameters=[
                                Column(name=resolve_tag_key(org_id, "session.status")),
                                resolve(org_id, "init"),
                            ],
                        ),
                    ],
                    alias="count",
                ),
                Function(
                    function="sumIf",
                    parameters=[
                        Column(name="value"),
                        Function(
                            function="equals",
                            parameters=[
                                Column(name=resolve_tag_key(org_id, "session.status")),
                                resolve(org_id, "crashed"),
                            ],
                        ),
                    ],
                    alias="crashed",
                ),
            ],
            "percentage(users_crashed, users) AS _crash_rate_alert_aggregate": lambda org_id: [
                Function(
                    function="uniq",
                    parameters=[
                        Column(name="value"),
                    ],
                    alias="count",
                ),
                Function(
                    function="uniqIf",
                    parameters=[
                        Column(name="value"),
                        Function(
                            function="equals",
                            parameters=[
                                Column(name=resolve_tag_key(org_id, "session.status")),
                                resolve(org_id, "crashed"),
                            ],
                        ),
                    ],
                    alias="crashed",
                ),
            ],
        },
        "count()": lambda org_id: [Function("count", parameters=[], alias="count")],
    }

    def run_test(
        self,
        dataset,
        aggregate,
        query,
        expected_conditions,
        entity_extra_fields=None,
        environment=None,
        granularity=None,
    ):
        time_window = 3600
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=dataset,
            aggregate=aggregate,
            time_window=time_window,
            extra_fields=entity_extra_fields,
        )
        snql_query = build_query_builder(
            entity_subscription,
            query,
            (self.project.id,),
            environment=environment,
            params={
                "organization_id": self.organization.id,
                "project_id": [self.project.id],
            },
        ).get_snql_query()
        select = self.string_aggregate_to_snql(dataset, aggregate)
        if dataset == QueryDatasets.SESSIONS:
            col_name = "sessions" if "sessions" in aggregate else "users"
            select.insert(
                0,
                Function(
                    function="identity", parameters=[Column(name=col_name)], alias="_total_count"
                ),
            )
        # Select order seems to be unstable, so just arbitrarily sort by name, alias so that it's consistent
        snql_query.query.select.sort(key=lambda q: (q.function, q.alias))
        expected_query = Query(
            match=Entity(map_aggregate_to_entity_key(dataset, aggregate).value),
            select=select,
            where=expected_conditions,
            groupby=[],
            having=[],
            orderby=[],
        )
        if granularity is not None:
            expected_query = expected_query.set_granularity(granularity)
        assert snql_query.query == expected_query

    def string_aggregate_to_snql(self, dataset, aggregate):
        aggregate_builder_func = self.aggregate_mappings[dataset].get(
            aggregate, self.aggregate_mappings.get(aggregate, lambda org_id: [])
        )
        return sorted(
            aggregate_builder_func(self.organization.id), key=lambda val: (val.function, val.alias)
        )

    def test_simple_events(self):
        self.run_test(
            QueryDatasets.EVENTS,
            "count_unique(user)",
            "",
            [
                Condition(Column(name="type"), Op.EQ, "error"),
                Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
            ],
        )

    def test_simple_transactions(self):
        self.run_test(
            QueryDatasets.TRANSACTIONS,
            "count_unique(user)",
            "",
            [
                Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
            ],
        )

    def test_aliased_query_events(self):
        self.create_release(self.project, version="something")
        expected_conditions = [
            And(
                conditions=[
                    Condition(Column(name="type"), Op.EQ, "error"),
                    Condition(
                        Function(
                            function="ifNull",
                            parameters=[Column(name="tags[sentry:release]"), ""],
                        ),
                        Op.IN,
                        ["something"],
                    ),
                ]
            ),
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
        ]
        self.run_test(
            QueryDatasets.EVENTS, "count_unique(user)", "release:latest", expected_conditions
        )

    def test_aliased_query_transactions(self):
        self.create_release(self.project, version="something")
        expected_conditions = [
            Condition(Column("release"), Op.IN, ["something"]),
            Condition(Column("project_id"), Op.IN, (self.project.id,)),
        ]
        self.run_test(
            QueryDatasets.TRANSACTIONS,
            "percentile(transaction.duration,.95)",
            "release:latest",
            expected_conditions,
        )

    def test_user_query(self):
        expected_conditions = [
            And(
                conditions=[
                    Condition(Column(name="type"), Op.EQ, "error"),
                    Condition(
                        Function(
                            function="ifNull",
                            parameters=[Column(name="tags[sentry:user]"), ""],
                        ),
                        Op.EQ,
                        "anengineer@work.io",
                    ),
                ]
            ),
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
        ]
        self.run_test(
            QueryDatasets.EVENTS, "count()", "user:anengineer@work.io", expected_conditions
        )

    def test_user_query_transactions(self):
        expected_conditions = [
            Condition(Column("user"), Op.EQ, "anengineer@work.io"),
            Condition(Column("project_id"), Op.IN, (self.project.id,)),
        ]
        self.run_test(
            QueryDatasets.TRANSACTIONS,
            "p95()",
            "user:anengineer@work.io",
            expected_conditions,
        )

    def test_boolean_query(self):
        self.create_release(self.project, version="something")
        expected_conditions = [
            And(
                [
                    Condition(Column(name="type"), Op.EQ, "error"),
                    Or(
                        [
                            Condition(
                                Function(
                                    "ifNull", parameters=[Column(name="tags[sentry:release]"), ""]
                                ),
                                Op.IN,
                                ["something"],
                            ),
                            Condition(
                                Function(
                                    "ifNull", parameters=[Column(name="tags[sentry:release]"), ""]
                                ),
                                Op.IN,
                                ["123"],
                            ),
                        ]
                    ),
                ]
            ),
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
        ]
        self.run_test(
            QueryDatasets.EVENTS,
            "count_unique(user)",
            "release:latest OR release:123",
            expected_conditions,
        )

    def test_event_types(self):
        self.create_release(self.project, version="something")
        expected_conditions = [
            And(
                [
                    Or(
                        [
                            Condition(Column(name="type"), Op.EQ, "error"),
                            Condition(Column(name="type"), Op.EQ, "default"),
                        ]
                    ),
                    Or(
                        [
                            Condition(
                                Function(
                                    "ifNull", parameters=[Column(name="tags[sentry:release]"), ""]
                                ),
                                Op.IN,
                                ["something"],
                            ),
                            Condition(
                                Function(
                                    "ifNull", parameters=[Column(name="tags[sentry:release]"), ""]
                                ),
                                Op.IN,
                                ["123"],
                            ),
                        ]
                    ),
                ]
            ),
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
        ]
        self.run_test(
            QueryDatasets.EVENTS,
            "count_unique(user)",
            "release:latest OR release:123",
            expected_conditions,
            entity_extra_fields={
                "event_types": [
                    SnubaQueryEventType.EventType.ERROR,
                    SnubaQueryEventType.EventType.DEFAULT,
                ]
            },
        )

    def test_issue_id_snql(self):
        expected_conditions = [
            And(
                [
                    Condition(Column(name="type"), Op.EQ, "error"),
                    Condition(
                        Column(name="group_id"),
                        Op.IN,
                        [self.group.id, 2],
                    ),
                ]
            ),
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
        ]
        self.run_test(
            QueryDatasets.EVENTS,
            "count_unique(user)",
            f"issue.id:[{self.group.id}, 2]",
            expected_conditions,
        )

    def test_simple_sessions(self):
        expected_conditions = [
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
            Condition(Column(name="org_id"), Op.EQ, self.organization.id),
        ]

        self.run_test(
            QueryDatasets.SESSIONS,
            "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate",
            "",
            expected_conditions,
            entity_extra_fields={"org_id": self.organization.id},
        )

    def test_simple_users(self):
        expected_conditions = [
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
            Condition(Column(name="org_id"), Op.EQ, self.organization.id),
        ]
        self.run_test(
            QueryDatasets.SESSIONS,
            "percentage(users_crashed, users) as _crash_rate_alert_aggregate",
            "",
            expected_conditions,
            entity_extra_fields={"org_id": self.organization.id},
        )

    def test_query_and_environment_sessions(self):
        env = self.create_environment(self.project, name="development")
        expected_conditions = [
            Condition(Column(name="release"), Op.IN, ["ahmed@12.2"]),
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
            Condition(Column(name="environment"), Op.EQ, "development"),
            Condition(Column(name="org_id"), Op.EQ, self.organization.id),
        ]
        self.run_test(
            QueryDatasets.SESSIONS,
            "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate",
            "release:ahmed@12.2",
            expected_conditions,
            entity_extra_fields={"org_id": self.organization.id},
            environment=env,
        )

    def test_query_and_environment_users(self):
        env = self.create_environment(self.project, name="development")
        expected_conditions = [
            Condition(Column(name="release"), Op.IN, ["ahmed@12.2"]),
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
            Condition(Column(name="environment"), Op.EQ, "development"),
            Condition(Column(name="org_id"), Op.EQ, self.organization.id),
        ]
        self.run_test(
            QueryDatasets.SESSIONS,
            "percentage(users_crashed, users) as _crash_rate_alert_aggregate",
            "release:ahmed@12.2",
            expected_conditions,
            entity_extra_fields={"org_id": self.organization.id},
            environment=env,
        )

    def test_simple_sessions_for_metrics(self):
        org_id = self.organization.id
        for tag in [SessionMRI.SESSION.value, "session.status", "crashed", "init"]:
            indexer.record(org_id, tag)
        expected_conditions = [
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
            Condition(Column(name="org_id"), Op.EQ, self.organization.id),
            Condition(
                Column(name="metric_id"),
                Op.EQ,
                resolve(self.organization.id, SessionMRI.SESSION.value),
            ),
            Condition(
                Column(name=resolve_tag_key(self.organization.id, "session.status")),
                Op.IN,
                resolve_many_weak(self.organization.id, ["crashed", "init"]),
            ),
        ]
        self.run_test(
            QueryDatasets.METRICS,
            "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate",
            "",
            expected_conditions,
            entity_extra_fields={"org_id": self.organization.id},
            granularity=10,
        )

    def test_simple_users_for_metrics(self):
        org_id = self.organization.id
        for tag in [SessionMRI.USER.value, "session.status", "crashed"]:
            indexer.record(org_id, tag)

        expected_conditions = [
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
            Condition(Column(name="org_id"), Op.EQ, self.organization.id),
            Condition(
                Column(name="metric_id"),
                Op.EQ,
                resolve(self.organization.id, SessionMRI.USER.value),
            ),
        ]
        self.run_test(
            QueryDatasets.METRICS,
            "percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
            "",
            expected_conditions,
            entity_extra_fields={"org_id": self.organization.id},
            granularity=10,
        )

    def test_query_and_environment_sessions_metrics(self):
        env = self.create_environment(self.project, name="development")
        org_id = self.organization.id
        for tag in [
            SessionMRI.SESSION.value,
            "session.status",
            "environment",
            "development",
            "init",
            "crashed",
            "release",
            "ahmed@12.2",
        ]:
            indexer.record(org_id, tag)

        expected_conditions = [
            Condition(
                Column(name=resolve_tag_key(self.organization.id, "release")),
                Op.EQ,
                resolve_weak(self.organization.id, "ahmed@12.2"),
            ),
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
            Condition(Column(name="org_id"), Op.EQ, self.organization.id),
            Condition(
                Column(name="metric_id"),
                Op.EQ,
                resolve(self.organization.id, SessionMRI.SESSION.value),
            ),
            Condition(
                Column(name=resolve_tag_key(self.organization.id, "session.status")),
                Op.IN,
                resolve_many_weak(self.organization.id, ["crashed", "init"]),
            ),
            Condition(
                Column(resolve_tag_key(self.organization.id, "environment")),
                Op.EQ,
                resolve_weak(self.organization.id, env.name),
            ),
        ]
        self.run_test(
            QueryDatasets.METRICS,
            "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate",
            "release:ahmed@12.2",
            expected_conditions,
            environment=env,
            entity_extra_fields={"org_id": self.organization.id},
            granularity=10,
        )

    def test_query_and_environment_users_metrics(self):
        env = self.create_environment(self.project, name="development")
        org_id = self.organization.id
        for tag in [
            SessionMRI.USER.value,
            "session.status",
            "environment",
            "development",
            "init",
            "crashed",
            "release",
            "ahmed@12.2",
        ]:
            indexer.record(org_id, tag)

        expected_conditions = [
            Condition(
                Column(name=resolve_tag_key(self.organization.id, "release")),
                Op.EQ,
                resolve_weak(self.organization.id, "ahmed@12.2"),
            ),
            Condition(Column(name="project_id"), Op.IN, (self.project.id,)),
            Condition(Column(name="org_id"), Op.EQ, self.organization.id),
            Condition(
                Column(name="metric_id"),
                Op.EQ,
                resolve(self.organization.id, SessionMRI.USER.value),
            ),
            Condition(
                Column(resolve_tag_key(self.organization.id, "environment")),
                Op.EQ,
                resolve_weak(self.organization.id, env.name),
            ),
        ]
        self.run_test(
            QueryDatasets.METRICS,
            "percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
            "release:ahmed@12.2",
            expected_conditions,
            environment=env,
            entity_extra_fields={"org_id": self.organization.id},
            granularity=10,
        )


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
