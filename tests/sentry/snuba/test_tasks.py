from __future__ import annotations

import abc
from datetime import timedelta
from functools import partial
from typing import Any
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
import responses
from django.utils import timezone
from sentry_protos.snuba.v1.endpoint_create_subscription_pb2 import CreateSubscriptionRequest
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import FUNCTION_COUNT
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter
from snuba_sdk import And, Column, Condition, Entity, Function, Join, Op, Or, Query, Relationship

from sentry.incidents.logic import query_datasets_to_type
from sentry.models.group import GroupStatus
from sentry.search.events.constants import METRICS_MAP
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve, resolve_tag_key, resolve_tag_value
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.entity_subscription import (
    apply_dataset_query_conditions,
    get_entity_key_from_query_builder,
    get_entity_subscription,
)
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.tasks import (
    SUBSCRIPTION_STATUS_MAX_AGE,
    create_subscription_in_snuba,
    delete_subscription_from_snuba,
    subscription_checker,
    update_subscription_in_snuba,
)
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from sentry.utils.snuba import _snuba_pool

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


def indexer_record(use_case_id: UseCaseID, org_id: int, string: str) -> int:
    ret = indexer.record(
        use_case_id=use_case_id,
        org_id=org_id,
        string=string,
    )
    assert ret is not None
    return ret


perf_indexer_record = partial(indexer_record, UseCaseID.TRANSACTIONS)
rh_indexer_record = partial(indexer_record, UseCaseID.SESSIONS)


class BaseSnubaTaskTest(TestCase, metaclass=abc.ABCMeta):
    __test__ = Abstract(__module__, __qualname__)

    status_translations = {
        QuerySubscription.Status.CREATING: "create",
        QuerySubscription.Status.UPDATING: "update",
        QuerySubscription.Status.DELETING: "delete",
    }

    @pytest.fixture(autouse=True)
    def _setup_metrics(self):
        with patch("sentry.snuba.tasks.metrics") as self.metrics:
            yield

    @abc.abstractproperty
    def expected_status(self):
        pass

    @abc.abstractmethod
    def task(self, subscription_id: int) -> None:
        pass

    def create_subscription(
        self,
        status=None,
        subscription_id=None,
        dataset=None,
        query=None,
        aggregate=None,
        time_window=None,
        query_extra=None,
    ):
        if status is None:
            status = self.expected_status
        if dataset is None:
            dataset = Dataset.Events
        if aggregate is None:
            aggregate = "count_unique(tags[sentry:user])"
        if query is None:
            query = "hello"
        if time_window is None:
            time_window = 60
        resolution = 60

        snuba_query = SnubaQuery.objects.create(
            type=query_datasets_to_type[dataset].value,
            dataset=dataset.value,
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
            query_extra=query_extra,
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


class CreateSubscriptionInSnubaTest(BaseSnubaTaskTest):
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

    def test_status_join(self):
        sub = self.create_subscription(QuerySubscription.Status.CREATING, query="status:unresolved")
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
            QuerySubscription.Status.CREATING, dataset=Dataset.Transactions
        )
        create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    def test_subscription_with_query_extra(self):
        sub = self.create_subscription(QuerySubscription.Status.CREATING, query_extra="foo:bar")
        create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    def test_subscription_with_query_extra_but_no_query(self):
        sub = self.create_subscription(QuerySubscription.Status.CREATING, query_extra="foo:bar")
        snuba_query = sub.snuba_query
        snuba_query.update(query="")
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
        for tag in [SessionMRI.RAW_SESSION.value, SessionMRI.RAW_USER.value, "session.status"]:
            rh_indexer_record(self.organization.id, tag)
        for time_window, expected_granularity in [
            (30, 10),
            (90, 60),
            (5 * 60, 3600),
            (25 * 60, 3600 * 24),
        ]:
            for idx, aggregate in enumerate(["sessions", "users"]):
                sub = self.create_subscription(
                    dataset=Dataset.Metrics,
                    aggregate=f"percentage({aggregate}_crashed, {aggregate}) AS "
                    f"_crash_rate_alert_aggregate",
                    query="",
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

    def test_insights_query_spm(self):
        time_window = 3600
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING,
            query="span.module:db",
            aggregate="spm()",
            dataset=Dataset.PerformanceMetrics,
            time_window=time_window,
        )
        with patch("sentry.snuba.tasks._snuba_pool") as pool:
            resp = Mock()
            resp.status = 202
            resp.data = json.dumps({"subscription_id": "123"})
            pool.urlopen.return_value = resp

            create_subscription_in_snuba(sub.id)
            request_body = json.loads(pool.urlopen.call_args[1]["body"])
            # Validate that the spm function uses the correct time window
            assert (
                "divide(countIf(value, equals(metric_id, 9223372036854776213)), divide(3600, 60)) AS `spm`"
                in request_body["query"]
            )
            assert request_body["granularity"] == 60
            assert request_body["time_window"] == time_window

            sub = QuerySubscription.objects.get(id=sub.id)
            assert sub.status == QuerySubscription.Status.ACTIVE.value
            assert sub.subscription_id is not None

    def test_eap_rpc_query_count(self):
        time_window = 3600
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING,
            query="span.op:http.client",
            aggregate="count(span.duration)",
            dataset=Dataset.EventsAnalyticsPlatform,
            time_window=time_window,
        )
        with patch("sentry.utils.snuba_rpc._snuba_pool") as pool:
            resp = Mock()
            resp.status = 202
            resp.data = b'\n"0/a92bba96a12e11ef8b0eaeb51d7f1da4'
            pool.urlopen.return_value = resp

            create_subscription_in_snuba(sub.id)

            rpc_request_body = pool.urlopen.call_args[1]["body"]
            createSubscriptionRequest = CreateSubscriptionRequest.FromString(rpc_request_body)

            assert createSubscriptionRequest.time_window_secs == time_window
            assert (
                createSubscriptionRequest.time_series_request.filter.comparison_filter.op
                == ComparisonFilter.Op.OP_EQUALS
            )
            assert (
                createSubscriptionRequest.time_series_request.filter.comparison_filter.key.name
                == "sentry.op"
            )
            assert (
                createSubscriptionRequest.time_series_request.filter.comparison_filter.value.val_str
                == "http.client"
            )
            assert (
                createSubscriptionRequest.time_series_request.aggregations[0].aggregate
                == FUNCTION_COUNT
            )
            assert (
                createSubscriptionRequest.time_series_request.aggregations[0].key.name
                == "sentry.duration_ms"
            )
            # Validate that the spm function uses the correct time window
            sub = QuerySubscription.objects.get(id=sub.id)
            assert sub.status == QuerySubscription.Status.ACTIVE.value
            assert sub.subscription_id is not None


class UpdateSubscriptionInSnubaTest(BaseSnubaTaskTest):
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

    def test_insights_query_spm(self):
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING,
            query="span.module:db",
            aggregate="spm()",
            dataset=Dataset.PerformanceMetrics,
        )
        create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

        sub.status = QuerySubscription.Status.UPDATING.value
        sub.update(
            status=QuerySubscription.Status.UPDATING.value, subscription_id=sub.subscription_id
        )
        update_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    def test_eap_rpc_query_count(self):
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING,
            query="span.op:http.client",
            aggregate="count(span.duration)",
            dataset=Dataset.EventsAnalyticsPlatform,
        )
        with patch("sentry.utils.snuba_rpc._snuba_pool") as rpc_pool:
            with patch("sentry.snuba.tasks._snuba_pool") as pool:
                resp = Mock()
                resp.status = 202
                resp.data = b'\n"0/a92bba96a12e11ef8b0eaeb51d7f1da4'
                rpc_pool.urlopen.return_value = resp
                pool.urlopen.return_value = resp

                create_subscription_in_snuba(sub.id)
                sub = QuerySubscription.objects.get(id=sub.id)
                assert sub.status == QuerySubscription.Status.ACTIVE.value
                assert sub.subscription_id is not None

                sub.status = QuerySubscription.Status.UPDATING.value
                sub.update(
                    status=QuerySubscription.Status.UPDATING.value,
                    subscription_id=sub.subscription_id,
                )
                update_subscription_in_snuba(sub.id)
                sub = QuerySubscription.objects.get(id=sub.id)
                assert sub.status == QuerySubscription.Status.ACTIVE.value
                assert sub.subscription_id is not None


class DeleteSubscriptionFromSnubaTest(BaseSnubaTaskTest):
    expected_status = QuerySubscription.Status.DELETING
    task = delete_subscription_from_snuba

    def test(self):
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DELETING, subscription_id=subscription_id
        )
        delete_subscription_from_snuba(sub.id)
        assert not QuerySubscription.objects.filter(id=sub.id).exists()

    def test_insights_query_spm(self):
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DELETING,
            subscription_id=subscription_id,
            query="span.module:db",
            aggregate="spm()",
            dataset=Dataset.PerformanceMetrics,
        )
        delete_subscription_from_snuba(sub.id)
        assert not QuerySubscription.objects.filter(id=sub.id).exists()

    def test_eap_rpc_query_count(self):
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DELETING,
            subscription_id=subscription_id,
            query="span.module:db",
            aggregate="count(span.duration)",
            dataset=Dataset.EventsAnalyticsPlatform,
        )
        with patch("sentry.snuba.tasks._snuba_pool") as pool:
            resp = Mock()
            resp.status = 202
            pool.urlopen.return_value = resp

            delete_subscription_from_snuba(sub.id)
            assert not QuerySubscription.objects.filter(id=sub.id).exists()

            (method, url) = pool.urlopen.call_args[0]
            assert method == "DELETE"
            assert (
                url
                == f"/{Dataset.EventsAnalyticsPlatform.value}/{EntityKey.EAPSpans.value}/subscriptions/{subscription_id}"
            )

    def test_no_subscription_id(self):
        sub = self.create_subscription(QuerySubscription.Status.DELETING)
        assert sub.subscription_id is None
        delete_subscription_from_snuba(sub.id)
        assert not QuerySubscription.objects.filter(id=sub.id).exists()

    def test_invalid_subscription_query(self):
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DELETING,
            subscription_id=subscription_id,
            query="issue:INVALID-1",
        )
        delete_subscription_from_snuba(sub.id)
        assert not QuerySubscription.objects.filter(id=sub.id).exists()

    def test_invalid_metrics_subscription_query(self):
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DELETING,
            dataset=Dataset.Metrics,
            subscription_id=subscription_id,
            query="release:1",
            aggregate="percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate",
        )
        delete_subscription_from_snuba(sub.id)
        assert not QuerySubscription.objects.filter(id=sub.id).exists()


class BuildSnqlQueryTest(TestCase):
    aggregate_mappings: dict[SnubaQuery.Type, dict[Dataset, dict[str, Any]]] = {
        SnubaQuery.Type.ERROR: {
            Dataset.Events: {
                "count_unique(user)": lambda org_id: [
                    Function(
                        function="uniq",
                        parameters=[
                            Column(
                                name="tags[sentry:user]",
                                entity=Entity(Dataset.Events.value, alias=Dataset.Events.value),
                            )
                        ],
                        alias="count_unique_user",
                    )
                ]
            },
        },
        SnubaQuery.Type.PERFORMANCE: {
            Dataset.Transactions: {
                "count_unique(user)": lambda org_id, **kwargs: [
                    Function(
                        function="uniq",
                        parameters=[Column(name="user")],
                        alias="count_unique_user",
                    )
                ],
                "percentile(transaction.duration,.95)": lambda org_id, **kwargs: [
                    Function(
                        "quantile(0.95)",
                        parameters=[Column(name="duration")],
                        alias="percentile_transaction_duration__95",
                    )
                ],
                "p95()": lambda org_id, **kwargs: [
                    Function("quantile(0.95)", parameters=[Column(name="duration")], alias="p95")
                ],
            },
            Dataset.Metrics: {
                "count_unique(user)": lambda org_id, metric_id, **kwargs: [
                    Function(
                        function="uniqIf",
                        parameters=[
                            Column(name="value"),
                            Function(
                                function="equals",
                                parameters=[Column(name="metric_id"), metric_id],
                            ),
                        ],
                        alias="count_unique_user",
                    )
                ],
                "percentile(transaction.duration,.95)": lambda org_id, metric_id, **kwargs: [
                    Function(
                        "arrayElement",
                        parameters=[
                            Function(
                                "quantilesIf(0.95)",
                                parameters=[
                                    Column("value"),
                                    Function(
                                        "equals",
                                        parameters=[Column("metric_id"), metric_id],
                                    ),
                                ],
                            ),
                            1,
                        ],
                        alias="percentile_transaction_duration__95",
                    )
                ],
                "p95()": lambda org_id, metric_id, **kwargs: [
                    Function(
                        "arrayElement",
                        parameters=[
                            Function(
                                "quantilesIf(0.95)",
                                parameters=[
                                    Column(name="value"),
                                    Function(
                                        "equals", parameters=[Column(name="metric_id"), metric_id]
                                    ),
                                ],
                            ),
                            1,
                        ],
                        alias="p95",
                    )
                ],
            },
        },
        SnubaQuery.Type.CRASH_RATE: {
            Dataset.Sessions: {
                "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate": lambda org_id, **kwargs: [
                    Function(
                        function="if",
                        parameters=[
                            Function(function="greater", parameters=[Column(name="sessions"), 0]),
                            Function(
                                function="divide",
                                parameters=[
                                    Column(name="sessions_crashed"),
                                    Column(name="sessions"),
                                ],
                            ),
                            None,
                        ],
                        alias="_crash_rate_alert_aggregate",
                    )
                ],
                "percentage(users_crashed, users) as _crash_rate_alert_aggregate": lambda org_id, **kwargs: [
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
            Dataset.Metrics: {
                "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate": lambda org_id, metric_mri, **kwargs: [
                    Function(
                        function="sumIf",
                        parameters=[
                            Column(name="value"),
                            Function(
                                function="and",
                                parameters=[
                                    Function(
                                        function="equals",
                                        parameters=[
                                            Column(name="metric_id"),
                                            resolve_tag_value(
                                                UseCaseKey.RELEASE_HEALTH, org_id, metric_mri
                                            ),
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="equals",
                                        parameters=[
                                            Column(
                                                name=resolve_tag_key(
                                                    UseCaseKey.RELEASE_HEALTH,
                                                    org_id,
                                                    "session.status",
                                                )
                                            ),
                                            resolve_tag_value(
                                                UseCaseKey.RELEASE_HEALTH, org_id, "init"
                                            ),
                                        ],
                                    ),
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
                                function="and",
                                parameters=[
                                    Function(
                                        function="equals",
                                        parameters=[
                                            Column(name="metric_id"),
                                            resolve_tag_value(
                                                UseCaseKey.RELEASE_HEALTH, org_id, metric_mri
                                            ),
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="equals",
                                        parameters=[
                                            Column(
                                                name=resolve_tag_key(
                                                    UseCaseKey.RELEASE_HEALTH,
                                                    org_id,
                                                    "session.status",
                                                )
                                            ),
                                            resolve_tag_value(
                                                UseCaseKey.RELEASE_HEALTH, org_id, "crashed"
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                        alias="crashed",
                    ),
                ],
                "percentage(users_crashed, users) AS _crash_rate_alert_aggregate": lambda org_id, metric_mri, **kwargs: [
                    Function(
                        function="uniqIf",
                        parameters=[
                            Column(name="value"),
                            Function(
                                function="equals",
                                parameters=[
                                    Column(name="metric_id"),
                                    resolve_tag_value(
                                        UseCaseKey.RELEASE_HEALTH, org_id, metric_mri
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias="count",
                    ),
                    Function(
                        function="uniqIf",
                        parameters=[
                            Column(name="value"),
                            Function(
                                function="and",
                                parameters=[
                                    Function(
                                        function="equals",
                                        parameters=[
                                            Column(name="metric_id"),
                                            resolve_tag_value(
                                                UseCaseKey.RELEASE_HEALTH, org_id, metric_mri
                                            ),
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="equals",
                                        parameters=[
                                            Column(
                                                name=resolve_tag_key(
                                                    UseCaseKey.RELEASE_HEALTH,
                                                    org_id,
                                                    "session.status",
                                                )
                                            ),
                                            resolve_tag_value(
                                                UseCaseKey.RELEASE_HEALTH, org_id, "crashed"
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                        alias="crashed",
                    ),
                ],
            },
        },
    }
    aggregate_mappings_fallback = {
        "count()": lambda org_id, **kwargs: [Function("count", parameters=[], alias="count")],
    }

    def run_test(
        self,
        query_type,
        dataset,
        aggregate,
        query,
        expected_conditions,
        entity_extra_fields=None,
        environment=None,
        granularity=None,
        aggregate_kwargs=None,
        # This flag is used to expect None clauses instead of [], it has been done in order to account for how the
        # metrics layer generates snql.
        use_none_clauses=False,
        expected_match=None,
    ):
        aggregate_kwargs = aggregate_kwargs if aggregate_kwargs else {}
        time_window = 3600
        entity_subscription = get_entity_subscription(
            query_type=query_type,
            dataset=dataset,
            aggregate=aggregate,
            time_window=time_window,
            extra_fields=entity_extra_fields,
        )
        query_builder = entity_subscription.build_query_builder(
            query=query,
            project_ids=[self.project.id],
            environment=environment,
            params={
                "organization_id": self.organization.id,
                "project_id": [self.project.id],
            },
        )
        snql_query = query_builder.get_snql_query()
        select = self.string_aggregate_to_snql(query_type, dataset, aggregate, aggregate_kwargs)
        if dataset == Dataset.Sessions:
            col_name = "sessions" if "sessions" in aggregate else "users"
            select.insert(
                0,
                Function(
                    function="identity", parameters=[Column(name=col_name)], alias="_total_count"
                ),
            )
        # Select order seems to be unstable, so just arbitrarily sort by name, alias so that it's consistent
        snql_query.query.select.sort(key=lambda q: (q.function, q.alias))
        if expected_match is None:
            entity_name = get_entity_key_from_query_builder(query_builder).value
            entity_args = {"name": entity_name}
            if dataset == Dataset.Events:
                entity_args["alias"] = entity_name
            expected_match = Entity(**entity_args)
        expected_query = Query(
            match=expected_match,
            select=select,
            where=expected_conditions,
            groupby=None if use_none_clauses else [],
            having=[],
            orderby=None if use_none_clauses else [],
        )
        if granularity is not None:
            expected_query = expected_query.set_granularity(granularity)
        assert snql_query.query == expected_query

    def string_aggregate_to_snql(self, query_type, dataset, aggregate, aggregate_kwargs):
        aggregate_builder_func = self.aggregate_mappings[query_type][dataset].get(
            aggregate, self.aggregate_mappings_fallback.get(aggregate, lambda org_id, **kwargs: [])
        )
        return sorted(
            aggregate_builder_func(self.organization.id, **aggregate_kwargs),
            key=lambda val: (val.function, val.alias),
        )

    def test_simple_events(self):
        entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        self.run_test(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "count_unique(user)",
            "",
            [
                Condition(Column(name="type", entity=entity), Op.EQ, "error"),
                Condition(Column(name="project_id", entity=entity), Op.IN, [self.project.id]),
            ],
        )

    def test_join_status(self):
        entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        g_entity = Entity("group_attributes", alias="ga")
        self.run_test(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "count_unique(user)",
            "status:unresolved",
            [
                And(
                    [
                        Condition(Column("type", entity=entity), Op.EQ, "error"),
                        Condition(
                            Column("group_status", entity=g_entity), Op.IN, [GroupStatus.UNRESOLVED]
                        ),
                    ]
                ),
                Condition(Column(name="project_id", entity=entity), Op.IN, [self.project.id]),
                Condition(
                    Column(name="project_id", entity=g_entity),
                    Op.IN,
                    [self.project.id],
                ),
            ],
            expected_match=Join([Relationship(entity, "attributes", g_entity)]),
        )

    def test_simple_performance_transactions(self):
        self.run_test(
            SnubaQuery.Type.PERFORMANCE,
            Dataset.Transactions,
            "count_unique(user)",
            "",
            [
                Condition(Column(name="project_id"), Op.IN, [self.project.id]),
            ],
        )

    def test_simple_performance_metrics(self):
        with Feature("organizations:custom-metrics"):
            metric_id = resolve(UseCaseID.TRANSACTIONS, self.organization.id, METRICS_MAP["user"])
            self.run_test(
                SnubaQuery.Type.PERFORMANCE,
                Dataset.Metrics,
                "count_unique(user)",
                "",
                [
                    Condition(Column("org_id"), Op.EQ, self.organization.id),
                    Condition(Column("project_id"), Op.IN, [self.project.id]),
                    Condition(Column("metric_id"), Op.IN, [metric_id]),
                ],
                entity_extra_fields={"org_id": self.organization.id},
                aggregate_kwargs={"metric_id": metric_id},
                granularity=60,
                use_none_clauses=True,
            )

    def test_aliased_query_events(self):
        self.create_release(self.project, version="something")
        entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        expected_conditions = [
            And(
                conditions=[
                    Condition(Column(name="type", entity=entity), Op.EQ, "error"),
                    Condition(
                        Function(
                            function="ifNull",
                            parameters=[Column(name="tags[sentry:release]", entity=entity), ""],
                        ),
                        Op.IN,
                        ["something"],
                    ),
                ]
            ),
            Condition(Column(name="project_id", entity=entity), Op.IN, [self.project.id]),
        ]
        self.run_test(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "count_unique(user)",
            "release:latest",
            expected_conditions,
        )

    def test_aliased_query_performance_transactions(self):
        self.create_release(self.project, version="something")
        expected_conditions = [
            Condition(Column("release"), Op.IN, ["something"]),
            Condition(Column("project_id"), Op.IN, [self.project.id]),
        ]
        self.run_test(
            SnubaQuery.Type.PERFORMANCE,
            Dataset.Transactions,
            "percentile(transaction.duration,.95)",
            "release:latest",
            expected_conditions,
        )

    def test_aliased_query_performance_metrics(self):
        with Feature("organizations:custom-metrics"):
            version = "something"
            self.create_release(self.project, version=version)
            metric_id = resolve(
                UseCaseID.TRANSACTIONS, self.organization.id, METRICS_MAP["transaction.duration"]
            )
            perf_indexer_record(self.organization.id, "release")
            perf_indexer_record(self.organization.id, version)
            expected_conditions = [
                Condition(Column("org_id"), Op.EQ, self.organization.id),
                Condition(Column("project_id"), Op.IN, [self.project.id]),
                Condition(
                    Column(
                        resolve_tag_key(UseCaseID.TRANSACTIONS, self.organization.id, "release")
                    ),
                    Op.EQ,
                    resolve_tag_value(UseCaseID.TRANSACTIONS, self.organization.id, version),
                ),
                Condition(Column("metric_id"), Op.IN, [metric_id]),
            ]

            self.run_test(
                SnubaQuery.Type.PERFORMANCE,
                Dataset.Metrics,
                "percentile(transaction.duration,.95)",
                f"release:{version}",
                expected_conditions,
                entity_extra_fields={"org_id": self.organization.id},
                aggregate_kwargs={"metric_id": metric_id},
                granularity=60,
                use_none_clauses=True,
            )

    def test_user_query(self):
        entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        expected_conditions = [
            And(
                conditions=[
                    Condition(Column(name="type", entity=entity), Op.EQ, "error"),
                    Condition(
                        Function(
                            function="ifNull",
                            parameters=[Column(name="tags[sentry:user]", entity=entity), ""],
                        ),
                        Op.EQ,
                        "anengineer@work.io",
                    ),
                ]
            ),
            Condition(Column(name="project_id", entity=entity), Op.IN, [self.project.id]),
        ]
        self.run_test(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "count()",
            "user:anengineer@work.io",
            expected_conditions,
        )

    def test_user_query_performance_transactions(self):
        expected_conditions = [
            Condition(Column("user"), Op.EQ, "anengineer@work.io"),
            Condition(Column("project_id"), Op.IN, [self.project.id]),
        ]
        self.run_test(
            SnubaQuery.Type.PERFORMANCE,
            Dataset.Transactions,
            "p95()",
            "user:anengineer@work.io",
            expected_conditions,
        )

    def test_tag_query_performance_metrics(self):
        with Feature("organizations:custom-metrics"):
            # Note: We don't support user queries on the performance metrics dataset, so using a
            # different tag here.
            metric_id = resolve(
                UseCaseID.TRANSACTIONS, self.organization.id, METRICS_MAP["transaction.duration"]
            )
            tag_key = "some_tag"
            tag_value = "some_value"
            perf_indexer_record(self.organization.id, tag_key)
            perf_indexer_record(self.organization.id, tag_value)

            expected_conditions = [
                Condition(Column("org_id"), Op.EQ, self.organization.id),
                Condition(Column("project_id"), Op.IN, [self.project.id]),
                Condition(
                    Column(resolve_tag_key(UseCaseID.TRANSACTIONS, self.organization.id, tag_key)),
                    Op.EQ,
                    resolve_tag_value(UseCaseID.TRANSACTIONS, self.organization.id, tag_value),
                ),
                Condition(Column("metric_id"), Op.IN, [metric_id]),
            ]

            self.run_test(
                SnubaQuery.Type.PERFORMANCE,
                Dataset.Metrics,
                "p95()",
                f"{tag_key}:{tag_value}",
                expected_conditions,
                entity_extra_fields={"org_id": self.organization.id},
                aggregate_kwargs={"metric_id": metric_id},
                granularity=60,
                use_none_clauses=True,
            )

    def test_boolean_query(self):
        self.create_release(self.project, version="something")
        entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        expected_conditions = [
            And(
                [
                    Condition(Column(name="type", entity=entity), Op.EQ, "error"),
                    Or(
                        [
                            Condition(
                                Function(
                                    "ifNull",
                                    parameters=[
                                        Column(name="tags[sentry:release]", entity=entity),
                                        "",
                                    ],
                                ),
                                Op.IN,
                                ["something"],
                            ),
                            Condition(
                                Function(
                                    "ifNull",
                                    parameters=[
                                        Column(name="tags[sentry:release]", entity=entity),
                                        "",
                                    ],
                                ),
                                Op.IN,
                                ["123"],
                            ),
                        ]
                    ),
                ]
            ),
            Condition(Column(name="project_id", entity=entity), Op.IN, [self.project.id]),
        ]
        self.run_test(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "count_unique(user)",
            "release:latest OR release:123",
            expected_conditions,
        )

    def test_event_types(self):
        self.create_release(self.project, version="something")
        entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        expected_conditions = [
            And(
                [
                    Or(
                        [
                            Condition(Column(name="type", entity=entity), Op.EQ, "error"),
                            Condition(Column(name="type", entity=entity), Op.EQ, "default"),
                        ]
                    ),
                    Or(
                        [
                            Condition(
                                Function(
                                    "ifNull",
                                    parameters=[
                                        Column(name="tags[sentry:release]", entity=entity),
                                        "",
                                    ],
                                ),
                                Op.IN,
                                ["something"],
                            ),
                            Condition(
                                Function(
                                    "ifNull",
                                    parameters=[
                                        Column(name="tags[sentry:release]", entity=entity),
                                        "",
                                    ],
                                ),
                                Op.IN,
                                ["123"],
                            ),
                        ]
                    ),
                ]
            ),
            Condition(Column(name="project_id", entity=entity), Op.IN, [self.project.id]),
        ]
        self.run_test(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
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
        entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        expected_conditions = [
            And(
                [
                    Condition(Column(name="type", entity=entity), Op.EQ, "error"),
                    Condition(
                        Column(name="group_id", entity=entity),
                        Op.IN,
                        [self.group.id, 2],
                    ),
                ]
            ),
            Condition(Column(name="project_id", entity=entity), Op.IN, [self.project.id]),
        ]
        self.run_test(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "count_unique(user)",
            f"issue.id:[{self.group.id}, 2]",
            expected_conditions,
        )

    def test_simple_sessions_for_metrics(self):
        with Feature("organizations:custom-metrics"):
            org_id = self.organization.id
            for tag in [SessionMRI.RAW_SESSION.value, "session.status", "crashed", "init"]:
                rh_indexer_record(org_id, tag)
            expected_conditions = [
                Condition(Column(name="org_id"), Op.EQ, self.organization.id),
                Condition(Column(name="project_id"), Op.IN, [self.project.id]),
                Condition(
                    Column(
                        name=resolve_tag_key(
                            UseCaseKey.RELEASE_HEALTH, self.organization.id, "session.status"
                        )
                    ),
                    Op.IN,
                    [
                        resolve_tag_value(
                            UseCaseKey.RELEASE_HEALTH, self.organization.id, "crashed"
                        ),
                        resolve_tag_value(UseCaseKey.RELEASE_HEALTH, self.organization.id, "init"),
                    ],
                ),
                Condition(
                    Column(name="metric_id"),
                    Op.IN,
                    [
                        resolve(
                            UseCaseKey.RELEASE_HEALTH,
                            self.organization.id,
                            SessionMRI.RAW_SESSION.value,
                        )
                    ],
                ),
            ]
            self.run_test(
                SnubaQuery.Type.CRASH_RATE,
                Dataset.Metrics,
                "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate",
                "",
                expected_conditions,
                entity_extra_fields={"org_id": self.organization.id},
                granularity=10,
                use_none_clauses=True,
                aggregate_kwargs={"metric_mri": SessionMRI.RAW_SESSION.value},
            )

    def test_simple_users_for_metrics(self):
        with Feature("organizations:custom-metrics"):
            org_id = self.organization.id
            for tag in [SessionMRI.RAW_USER.value, "session.status", "crashed"]:
                rh_indexer_record(org_id, tag)

            expected_conditions = [
                Condition(Column(name="org_id"), Op.EQ, self.organization.id),
                Condition(Column(name="project_id"), Op.IN, [self.project.id]),
                Condition(
                    Column(name="metric_id"),
                    Op.IN,
                    [
                        resolve(
                            UseCaseKey.RELEASE_HEALTH,
                            self.organization.id,
                            SessionMRI.RAW_USER.value,
                        )
                    ],
                ),
            ]
            self.run_test(
                SnubaQuery.Type.CRASH_RATE,
                Dataset.Metrics,
                "percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
                "",
                expected_conditions,
                entity_extra_fields={"org_id": self.organization.id},
                granularity=10,
                use_none_clauses=True,
                aggregate_kwargs={"metric_mri": SessionMRI.RAW_USER.value},
            )

    def test_query_and_environment_sessions_metrics(self):
        with Feature("organizations:custom-metrics"):
            env = self.create_environment(self.project, name="development")
            org_id = self.organization.id
            for tag in [
                SessionMRI.RAW_SESSION.value,
                "session.status",
                "environment",
                "development",
                "init",
                "crashed",
                "release",
                "ahmed@12.2",
            ]:
                rh_indexer_record(org_id, tag)

            expected_conditions = [
                Condition(Column(name="org_id"), Op.EQ, self.organization.id),
                Condition(Column(name="project_id"), Op.IN, [self.project.id]),
                Condition(
                    Column(
                        name=resolve_tag_key(
                            UseCaseKey.RELEASE_HEALTH, self.organization.id, "release"
                        )
                    ),
                    Op.EQ,
                    resolve_tag_value(
                        UseCaseKey.RELEASE_HEALTH, self.organization.id, "ahmed@12.2"
                    ),
                ),
                Condition(
                    Column(
                        resolve_tag_key(
                            UseCaseKey.RELEASE_HEALTH, self.organization.id, "environment"
                        )
                    ),
                    Op.EQ,
                    resolve_tag_value(UseCaseKey.RELEASE_HEALTH, self.organization.id, env.name),
                ),
                Condition(
                    Column(
                        name=resolve_tag_key(
                            UseCaseKey.RELEASE_HEALTH, self.organization.id, "session.status"
                        )
                    ),
                    Op.IN,
                    [
                        resolve_tag_value(
                            UseCaseKey.RELEASE_HEALTH, self.organization.id, "crashed"
                        ),
                        resolve_tag_value(UseCaseKey.RELEASE_HEALTH, self.organization.id, "init"),
                    ],
                ),
                Condition(
                    Column(name="metric_id"),
                    Op.IN,
                    [
                        resolve(
                            UseCaseKey.RELEASE_HEALTH,
                            self.organization.id,
                            SessionMRI.RAW_SESSION.value,
                        )
                    ],
                ),
            ]
            self.run_test(
                SnubaQuery.Type.CRASH_RATE,
                Dataset.Metrics,
                "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate",
                "release:ahmed@12.2",
                expected_conditions,
                environment=env,
                entity_extra_fields={"org_id": self.organization.id},
                granularity=10,
                use_none_clauses=True,
                aggregate_kwargs={
                    "metric_mri": SessionMRI.RAW_SESSION.value,
                },
            )

    def test_query_and_environment_users_metrics(self):
        with Feature("organizations:custom-metrics"):
            env = self.create_environment(self.project, name="development")
            org_id = self.organization.id
            for tag in [
                SessionMRI.RAW_USER.value,
                "session.status",
                "environment",
                "development",
                "init",
                "crashed",
                "release",
                "ahmed@12.2",
            ]:
                rh_indexer_record(org_id, tag)

            expected_conditions = [
                Condition(Column(name="org_id"), Op.EQ, self.organization.id),
                Condition(Column(name="project_id"), Op.IN, [self.project.id]),
                Condition(
                    Column(
                        name=resolve_tag_key(
                            UseCaseKey.RELEASE_HEALTH, self.organization.id, "release"
                        )
                    ),
                    Op.EQ,
                    resolve_tag_value(
                        UseCaseKey.RELEASE_HEALTH, self.organization.id, "ahmed@12.2"
                    ),
                ),
                Condition(
                    Column(
                        resolve_tag_key(
                            UseCaseKey.RELEASE_HEALTH, self.organization.id, "environment"
                        )
                    ),
                    Op.EQ,
                    resolve_tag_value(UseCaseKey.RELEASE_HEALTH, self.organization.id, env.name),
                ),
                Condition(
                    Column(name="metric_id"),
                    Op.IN,
                    [
                        resolve(
                            UseCaseKey.RELEASE_HEALTH,
                            self.organization.id,
                            SessionMRI.RAW_USER.value,
                        )
                    ],
                ),
            ]
            self.run_test(
                SnubaQuery.Type.CRASH_RATE,
                Dataset.Metrics,
                "percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
                "release:ahmed@12.2",
                expected_conditions,
                environment=env,
                entity_extra_fields={
                    "org_id": self.organization.id,
                },
                granularity=10,
                use_none_clauses=True,
                aggregate_kwargs={
                    "metric_mri": SessionMRI.RAW_USER.value,
                },
            )


class TestApplyDatasetQueryConditions(TestCase):
    def test_no_event_types_no_discover(self):
        assert (
            apply_dataset_query_conditions(SnubaQuery.Type.ERROR, "release:123", None, False)
            == "(event.type:error) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.ERROR, "release:123 OR release:456", None, False
            )
            == "(event.type:error) AND (release:123 OR release:456)"
        )
        assert (
            apply_dataset_query_conditions(SnubaQuery.Type.PERFORMANCE, "release:123", None, False)
            == "release:123"
        )
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.PERFORMANCE, "release:123 OR release:456", None, False
            )
            == "release:123 OR release:456"
        )

    def test_no_event_types_discover(self):
        assert (
            apply_dataset_query_conditions(SnubaQuery.Type.ERROR, "release:123", None, True)
            == "(event.type:error) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.ERROR, "release:123 OR release:456", None, True
            )
            == "(event.type:error) AND (release:123 OR release:456)"
        )
        assert (
            apply_dataset_query_conditions(SnubaQuery.Type.PERFORMANCE, "release:123", None, True)
            == "(event.type:transaction) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.PERFORMANCE, "release:123 OR release:456", None, True
            )
            == "(event.type:transaction) AND (release:123 OR release:456)"
        )

    def test_event_types_no_discover(self):
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.ERROR, "release:123", [SnubaQueryEventType.EventType.ERROR], False
            )
            == "(event.type:error) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.ERROR,
                "release:123",
                [SnubaQueryEventType.EventType.ERROR, SnubaQueryEventType.EventType.DEFAULT],
                False,
            )
            == "(event.type:error OR event.type:default) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.PERFORMANCE,
                "release:123",
                [SnubaQueryEventType.EventType.TRANSACTION],
                False,
            )
            == "release:123"
        )
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.CRASH_RATE,
                "release:123",
                [],
                False,
            )
            == "release:123"
        )

    def test_event_types_discover(self):
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.ERROR, "release:123", [SnubaQueryEventType.EventType.ERROR], True
            )
            == "(event.type:error) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.ERROR,
                "release:123",
                [SnubaQueryEventType.EventType.ERROR, SnubaQueryEventType.EventType.DEFAULT],
                True,
            )
            == "(event.type:error OR event.type:default) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.PERFORMANCE,
                "release:123",
                [SnubaQueryEventType.EventType.TRANSACTION],
                True,
            )
            == "(event.type:transaction) AND (release:123)"
        )


class SubscriptionCheckerTest(TestCase):
    def create_subscription(self, status, subscription_id=None, date_updated=None):
        dataset = Dataset.Events.value
        aggregate = "count_unique(tags[sentry:user])"
        query = "hello"
        time_window = 60
        resolution = 60

        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
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
