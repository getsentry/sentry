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
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_tag_key, resolve_tag_value
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.entity_subscription import (
    apply_dataset_query_conditions,
    get_entity_key_from_query_builder,
    get_entity_subscription,
)
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.tasks import (
    BROKEN_GRACE_PERIOD,
    SUBSCRIPTION_STATUS_MAX_AGE,
    SubscriptionError,
    create_subscription_in_snuba,
    delete_subscription_from_snuba,
    recheck_broken_subscription,
    schedule_broken_subscription_rechecks,
    subscription_checker,
    update_subscription_in_snuba,
)
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from sentry.utils.snuba import SnubaError, _snuba_pool
from sentry.utils.snuba_rpc import SnubaRPCBadRequest

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
    def _setup_metrics(self) -> object:
        with patch("sentry.snuba.tasks.metrics") as self.metrics:
            yield

    @abc.abstractproperty
    def expected_status(self) -> Any:
        pass

    @abc.abstractmethod
    def task(self, subscription_id: int) -> Any:
        pass

    def create_subscription(
        self,
        status: Any = None,
        subscription_id: Any = None,
        dataset: Any = None,
        query: Any = None,
        aggregate: Any = None,
        time_window: Any = None,
        query_extra: Any = None,
        date_updated: Any = None,
    ) -> Any:
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
            date_updated=date_updated or timezone.now(),
        )

    def test_no_subscription(self) -> None:
        self.task(12345)
        self.metrics.incr.assert_called_once_with(
            f"snuba.subscriptions.{self.status_translations[self.expected_status]}.subscription_does_not_exist"
        )

    def test_invalid_status(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.ACTIVE)
        self.task(sub.id)
        self.metrics.incr.assert_called_once_with(
            f"snuba.subscriptions.{self.status_translations[self.expected_status]}.incorrect_status"
        )


class CreateSubscriptionInSnubaTest(BaseSnubaTaskTest):
    expected_status = QuerySubscription.Status.CREATING
    task = create_subscription_in_snuba  # type: ignore[assignment]

    def test_already_created(self) -> None:
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING, subscription_id=uuid4().hex
        )
        create_subscription_in_snuba(sub.id)
        self.metrics.incr.assert_any_call("snuba.subscriptions.create.already_created_in_snuba")

    def test(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.CREATING)
        create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    def test_broken_query(self) -> None:
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING,
            query="issue:INVALID-1",
            date_updated=timezone.now() - BROKEN_GRACE_PERIOD * 2,
        )
        with patch("sentry.snuba.tasks.sentry_sdk.capture_exception") as capture_exception:
            create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.BROKEN.value
        assert sub.subscription_id is None
        tags = {"action": "create", "dataset": "events", "error_type": "InvalidIssueSearchQuery"}
        self.metrics.incr.assert_any_call("snuba.subscriptions.marked_broken", tags=tags)
        capture_exception.assert_called_once()
        assert isinstance(capture_exception.call_args[0][0], SubscriptionError)
        assert capture_exception.call_args[1]["tags"] == tags

    def test_broken_query_within_grace_period(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.CREATING, query="issue:INVALID-1")
        with patch("sentry.snuba.tasks.sentry_sdk.capture_exception") as capture_exception:
            create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.CREATING.value
        capture_exception.assert_not_called()
        assert "snuba.subscriptions.marked_broken" not in [
            c.args[0] for c in self.metrics.incr.call_args_list
        ]

    def test_broken_query_concurrent_edit_restarts_grace_period(self) -> None:
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING,
            date_updated=timezone.now() - BROKEN_GRACE_PERIOD * 2,
        )

        def edit_concurrently(subscription: QuerySubscription) -> str:
            QuerySubscription.objects.filter(id=subscription.id).update(date_updated=timezone.now())
            raise SubscriptionError("invalid")

        with patch("sentry.snuba.tasks._create_in_snuba", side_effect=edit_concurrently):
            create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.CREATING.value

    def test_already_created_broken_query(self) -> None:
        subscription_id = uuid4().hex
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING,
            subscription_id=subscription_id,
            query="status:400",
            date_updated=timezone.now() - BROKEN_GRACE_PERIOD * 2,
        )
        assert (
            QuerySubscription.objects.get_from_cache(subscription_id=subscription_id).id == sub.id
        )
        with patch("sentry.snuba.tasks._delete_from_snuba") as delete_from_snuba:
            create_subscription_in_snuba(sub.id)
        delete_from_snuba.assert_not_called()
        self.metrics.incr.assert_any_call(
            "snuba.subscriptions.entity_key_unresolved", tags={"action": "create"}
        )
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.BROKEN.value
        assert sub.subscription_id is None
        # The consumer relies on this lookup missing to clean up the Snuba subscription.
        with pytest.raises(QuerySubscription.DoesNotExist):
            QuerySubscription.objects.get_from_cache(subscription_id=subscription_id)

    def test_broken_query_does_not_overwrite_concurrent_status(self) -> None:
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING,
            date_updated=timezone.now() - BROKEN_GRACE_PERIOD * 2,
        )

        def delete_concurrently(subscription: QuerySubscription) -> str:
            QuerySubscription.objects.filter(id=subscription.id).update(
                status=QuerySubscription.Status.DELETING.value
            )
            raise SubscriptionError("invalid")

        with patch("sentry.snuba.tasks._create_in_snuba", side_effect=delete_concurrently):
            create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.DELETING.value

    def test_rejected_by_snuba(self) -> None:
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING,
            time_window=0,
            date_updated=timezone.now() - BROKEN_GRACE_PERIOD * 2,
        )
        with patch("sentry.snuba.tasks.sentry_sdk.capture_exception") as capture_exception:
            create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.BROKEN.value
        tags = {"action": "create", "dataset": "events", "error_type": "SnubaError"}
        self.metrics.incr.assert_any_call("snuba.subscriptions.marked_broken", tags=tags)
        error = capture_exception.call_args[0][0]
        assert isinstance(error, SubscriptionError)
        assert "HTTP 400" in str(error)

    def test_rejected_by_snuba_rpc(self) -> None:
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING,
            query="span.op:http.client",
            aggregate="count(span.duration)",
            dataset=Dataset.EventsAnalyticsPlatform,
            time_window=3600,
            date_updated=timezone.now() - BROKEN_GRACE_PERIOD * 2,
        )
        with (
            patch(
                "sentry.snuba.tasks.snuba_rpc.create_subscription",
                side_effect=SnubaRPCBadRequest("invalid"),
            ),
            patch("sentry.snuba.tasks.sentry_sdk.capture_exception"),
        ):
            create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.BROKEN.value
        self.metrics.incr.assert_any_call(
            "snuba.subscriptions.marked_broken",
            tags={
                "action": "create",
                "dataset": "events_analytics_platform",
                "error_type": "SnubaRPCBadRequest",
            },
        )

    def test_snuba_error_not_marked_broken(self) -> None:
        for status in (429, 500):
            sub = self.create_subscription(
                QuerySubscription.Status.CREATING,
                date_updated=timezone.now() - BROKEN_GRACE_PERIOD * 2,
            )
            with patch("sentry.snuba.tasks._snuba_pool") as pool:
                pool.urlopen.return_value = Mock(status=status, data=b"")
                with pytest.raises(SnubaError):
                    create_subscription_in_snuba(sub.id)
            sub = QuerySubscription.objects.get(id=sub.id)
            assert sub.status == QuerySubscription.Status.CREATING.value

    def test_status_join(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.CREATING, query="status:unresolved")
        create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    def test_group_id(self) -> None:
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

    def test_transaction(self) -> None:
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING, dataset=Dataset.Transactions
        )
        create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    def test_subscription_with_query_extra(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.CREATING, query_extra="foo:bar")
        create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    def test_subscription_with_query_extra_but_no_query(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.CREATING, query_extra="foo:bar")
        snuba_query = sub.snuba_query
        snuba_query.update(query="")
        create_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    @responses.activate
    def test_adds_type(self) -> None:
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
    def test_granularity_on_metrics_crash_rate_alerts(self) -> None:
        for tag in [
            SessionMRI.RAW_SESSION.value,
            SessionMRI.RAW_USER.value,
            "session.status",
        ]:
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

    def test_eap_rpc_query_count(self) -> None:
        time_window = 3600
        sub = self.create_subscription(
            QuerySubscription.Status.CREATING,
            query="span.op:http.client",
            aggregate="count(span.duration)",
            dataset=Dataset.EventsAnalyticsPlatform,
            time_window=time_window,
        )
        with patch.object(_snuba_pool, "urlopen", side_effect=_snuba_pool.urlopen) as urlopen:
            create_subscription_in_snuba(sub.id)

            rpc_request_body = urlopen.call_args[1]["body"]
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
                createSubscriptionRequest.time_series_request.expressions[0].aggregation.aggregate
                == FUNCTION_COUNT
            )
            assert (
                createSubscriptionRequest.time_series_request.expressions[0].aggregation.key.name
                == "sentry.project_id"
            )
            # Validate that the spm function uses the correct time window
            sub = QuerySubscription.objects.get(id=sub.id)
            assert sub.status == QuerySubscription.Status.ACTIVE.value
            assert sub.subscription_id is not None


class UpdateSubscriptionInSnubaTest(BaseSnubaTaskTest):
    expected_status = QuerySubscription.Status.UPDATING
    task = update_subscription_in_snuba  # type: ignore[assignment]

    def test(self) -> None:
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.UPDATING, subscription_id=subscription_id
        )
        update_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None
        assert sub.subscription_id != subscription_id

    def test_no_subscription_id(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.UPDATING)
        assert sub.subscription_id is None
        update_subscription_in_snuba(sub.id)
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None

    def test_unresolvable_old_query(self) -> None:
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.UPDATING, subscription_id=subscription_id
        )
        with patch("sentry.snuba.tasks._delete_from_snuba") as delete_from_snuba:
            update_subscription_in_snuba(sub.id, old_query="status:400")
        delete_from_snuba.assert_not_called()
        self.metrics.incr.assert_any_call(
            "snuba.subscriptions.entity_key_unresolved", tags={"action": "update"}
        )
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id not in (None, subscription_id)

    def test_broken_query(self) -> None:
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.UPDATING,
            subscription_id=subscription_id,
            query="issue:INVALID-1",
            date_updated=timezone.now() - BROKEN_GRACE_PERIOD * 2,
        )
        with patch("sentry.snuba.tasks._delete_from_snuba") as delete_from_snuba:
            update_subscription_in_snuba(sub.id)
        delete_from_snuba.assert_called_once()
        assert delete_from_snuba.call_args[0][1] == subscription_id
        self.metrics.incr.assert_any_call(
            "snuba.subscriptions.marked_broken",
            tags={"action": "update", "dataset": "events", "error_type": "InvalidIssueSearchQuery"},
        )
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.BROKEN.value
        assert sub.subscription_id is None

    def test_rejected_by_snuba(self) -> None:
        sub = self.create_subscription(
            QuerySubscription.Status.UPDATING,
            subscription_id=f"1/{uuid4().hex}",
            time_window=0,
            date_updated=timezone.now() - BROKEN_GRACE_PERIOD * 2,
        )
        with (
            patch("sentry.snuba.tasks._delete_from_snuba"),
            patch("sentry.snuba.tasks.sentry_sdk.capture_exception"),
        ):
            update_subscription_in_snuba(sub.id)
        self.metrics.incr.assert_any_call(
            "snuba.subscriptions.marked_broken",
            tags={"action": "update", "dataset": "events", "error_type": "SnubaError"},
        )
        sub = QuerySubscription.objects.get(id=sub.id)
        assert sub.status == QuerySubscription.Status.BROKEN.value
        assert sub.subscription_id is None

    def test_eap_rpc_query_count(self) -> None:
        with patch.object(_snuba_pool, "urlopen", side_effect=_snuba_pool.urlopen) as urlopen:
            sub = self.create_subscription(
                QuerySubscription.Status.CREATING,
                query="span.op:http.client",
                aggregate="count(span.duration)",
                dataset=Dataset.EventsAnalyticsPlatform,
            )
            create_subscription_in_snuba(sub.id)
            sub = QuerySubscription.objects.get(id=sub.id)
            assert sub.status == QuerySubscription.Status.ACTIVE.value
            assert sub.subscription_id is not None

            subscription_id = sub.subscription_id

            sub.update(
                status=QuerySubscription.Status.UPDATING.value,
            )
            update_subscription_in_snuba(sub.id)
            sub = QuerySubscription.objects.get(id=sub.id)
            assert sub.status == QuerySubscription.Status.ACTIVE.value
            assert sub.subscription_id is not None

            (method, url) = urlopen.call_args_list[1][0]
            assert method == "DELETE"
            assert (
                url
                == f"/{Dataset.EventsAnalyticsPlatform.value}/{EntityKey.EAPItems.value}/subscriptions/{subscription_id}"
            )

            sub.update(
                status=QuerySubscription.Status.DELETING.value,
            )
            delete_subscription_from_snuba(sub.id)
            assert not QuerySubscription.objects.filter(id=sub.id).exists()


class DeleteSubscriptionFromSnubaTest(BaseSnubaTaskTest):
    expected_status = QuerySubscription.Status.DELETING
    task = delete_subscription_from_snuba  # type: ignore[assignment]

    def test(self) -> None:
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DELETING, subscription_id=subscription_id
        )
        delete_subscription_from_snuba(sub.id)
        assert not QuerySubscription.objects.filter(id=sub.id).exists()

    def test_eap_rpc_query_count(self) -> None:
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DELETING,
            subscription_id=subscription_id,
            query="span.module:db",
            aggregate="count(span.duration)",
            dataset=Dataset.EventsAnalyticsPlatform,
        )
        with patch.object(_snuba_pool, "urlopen", side_effect=_snuba_pool.urlopen) as urlopen:
            delete_subscription_from_snuba(sub.id)
            assert not QuerySubscription.objects.filter(id=sub.id).exists()

            (method, url) = urlopen.call_args[0]
            assert method == "DELETE"
            assert (
                url
                == f"/{Dataset.EventsAnalyticsPlatform.value}/{EntityKey.EAPItems.value}/subscriptions/{subscription_id}"
            )

    def test_performance_metrics_skips_snuba(self) -> None:
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DELETING,
            subscription_id=subscription_id,
            dataset=Dataset.PerformanceMetrics,
            query='http.url:"http://example.com/*"',
            aggregate="p90(transaction.duration)",
        )
        with patch.object(_snuba_pool, "urlopen") as urlopen:
            delete_subscription_from_snuba(sub.id)
        urlopen.assert_not_called()
        assert not QuerySubscription.objects.filter(id=sub.id).exists()

    def test_performance_metrics_disabled_clears_subscription_id(self) -> None:
        sub = self.create_subscription(
            QuerySubscription.Status.DISABLED,
            subscription_id=f"1/{uuid4().hex}",
            dataset=Dataset.PerformanceMetrics,
            query='http.url:"http://example.com/*"',
            aggregate="p90(transaction.duration)",
        )
        with patch.object(_snuba_pool, "urlopen") as urlopen:
            delete_subscription_from_snuba(sub.id)
        urlopen.assert_not_called()
        sub.refresh_from_db()
        assert sub.subscription_id is None

    def test_no_subscription_id(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.DELETING)
        assert sub.subscription_id is None
        delete_subscription_from_snuba(sub.id)
        assert not QuerySubscription.objects.filter(id=sub.id).exists()

    def test_invalid_subscription_query(self) -> None:
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DELETING,
            subscription_id=subscription_id,
            query="issue:INVALID-1",
        )
        delete_subscription_from_snuba(sub.id)
        assert not QuerySubscription.objects.filter(id=sub.id).exists()

    def test_invalid_metrics_subscription_query(self) -> None:
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

    def test_query_that_raises_invalid_search_query(self) -> None:
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DELETING,
            dataset=Dataset.Metrics,
            subscription_id=subscription_id,
            query="project:foo",
            aggregate="percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate",
        )
        with patch("sentry.snuba.tasks._delete_from_snuba") as delete_from_snuba:
            delete_subscription_from_snuba(sub.id)
        delete_from_snuba.assert_not_called()
        self.metrics.incr.assert_any_call(
            "snuba.subscriptions.entity_key_unresolved", tags={"action": "delete"}
        )
        assert not QuerySubscription.objects.filter(id=sub.id).exists()

    def test_disabled_unresolvable_entity_key_clears_subscription_id(self) -> None:
        subscription_id = f"1/{uuid4().hex}"
        sub = self.create_subscription(
            QuerySubscription.Status.DISABLED,
            dataset=Dataset.Metrics,
            subscription_id=subscription_id,
            query="project:foo",
            aggregate="percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate",
        )
        with patch("sentry.snuba.tasks._delete_from_snuba") as delete_from_snuba:
            delete_subscription_from_snuba(sub.id)
        delete_from_snuba.assert_not_called()
        sub.refresh_from_db()
        assert sub.subscription_id is None


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
                    Function(
                        "quantile(0.95)",
                        parameters=[Column(name="duration")],
                        alias="p95",
                    )
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
                                        "equals",
                                        parameters=[
                                            Column(name="metric_id"),
                                            metric_id,
                                        ],
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
                "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate": lambda org_id,
                **kwargs: [
                    Function(
                        function="if",
                        parameters=[
                            Function(
                                function="greater",
                                parameters=[Column(name="sessions"), 0],
                            ),
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
                "percentage(users_crashed, users) as _crash_rate_alert_aggregate": lambda org_id,
                **kwargs: [
                    Function(
                        function="if",
                        parameters=[
                            Function(function="greater", parameters=[Column(name="users"), 0]),
                            Function(
                                function="divide",
                                parameters=[
                                    Column(name="users_crashed"),
                                    Column(name="users"),
                                ],
                            ),
                            None,
                        ],
                        alias="_crash_rate_alert_aggregate",
                    )
                ],
            },
            Dataset.Metrics: {
                "percentage(sessions_crashed, sessions) as _crash_rate_alert_aggregate": lambda org_id,
                metric_mri,
                **kwargs: [
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
                                                UseCaseKey.RELEASE_HEALTH,
                                                org_id,
                                                metric_mri,
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
                                                UseCaseKey.RELEASE_HEALTH,
                                                org_id,
                                                "init",
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
                                                UseCaseKey.RELEASE_HEALTH,
                                                org_id,
                                                metric_mri,
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
                                                UseCaseKey.RELEASE_HEALTH,
                                                org_id,
                                                "crashed",
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                        alias="crashed",
                    ),
                ],
                "percentage(users_crashed, users) AS _crash_rate_alert_aggregate": lambda org_id,
                metric_mri,
                **kwargs: [
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
                                                UseCaseKey.RELEASE_HEALTH,
                                                org_id,
                                                metric_mri,
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
                                                UseCaseKey.RELEASE_HEALTH,
                                                org_id,
                                                "crashed",
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
        query_type: Any,
        dataset: Any,
        aggregate: Any,
        query: Any,
        expected_conditions: Any,
        entity_extra_fields: Any = None,
        environment: Any = None,
        granularity: Any = None,
        aggregate_kwargs: Any = None,
        # This flag is used to expect None clauses instead of [], it has been done in order to account for how the
        # metrics layer generates snql.
        use_none_clauses: bool = False,
        expected_match: Any = None,
    ) -> None:
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
                    function="identity",
                    parameters=[Column(name=col_name)],
                    alias="_total_count",
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

    def string_aggregate_to_snql(
        self, query_type: Any, dataset: Any, aggregate: Any, aggregate_kwargs: Any
    ) -> Any:
        aggregate_builder_func = self.aggregate_mappings[query_type][dataset].get(
            aggregate,
            self.aggregate_mappings_fallback.get(aggregate, lambda org_id, **kwargs: []),
        )
        return sorted(
            aggregate_builder_func(self.organization.id, **aggregate_kwargs),
            key=lambda val: (val.function, val.alias),
        )

    def test_simple_events(self) -> None:
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

    def test_join_status(self) -> None:
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
                            Column("group_status", entity=g_entity),
                            Op.IN,
                            [GroupStatus.UNRESOLVED],
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

    def test_simple_performance_transactions(self) -> None:
        self.run_test(
            SnubaQuery.Type.PERFORMANCE,
            Dataset.Transactions,
            "count_unique(user)",
            "",
            [
                Condition(Column(name="project_id"), Op.IN, [self.project.id]),
            ],
        )

    def test_aliased_query_events(self) -> None:
        self.create_release(self.project, version="something")
        entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        expected_conditions = [
            And(
                conditions=[
                    Condition(Column(name="type", entity=entity), Op.EQ, "error"),
                    Condition(
                        Function(
                            function="ifNull",
                            parameters=[
                                Column(name="tags[sentry:release]", entity=entity),
                                "",
                            ],
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

    def test_aliased_query_performance_transactions(self) -> None:
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

    def test_user_query(self) -> None:
        entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        expected_conditions = [
            And(
                conditions=[
                    Condition(Column(name="type", entity=entity), Op.EQ, "error"),
                    Condition(
                        Function(
                            function="ifNull",
                            parameters=[
                                Column(name="tags[sentry:user]", entity=entity),
                                "",
                            ],
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

    def test_user_query_performance_transactions(self) -> None:
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

    def test_boolean_query(self) -> None:
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

    def test_event_types(self) -> None:
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

    def test_issue_id_snql(self) -> None:
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


class TestApplyDatasetQueryConditions(TestCase):
    def test_no_event_types_no_discover(self) -> None:
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

    def test_no_event_types_discover(self) -> None:
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

    def test_event_types_no_discover(self) -> None:
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.ERROR,
                "release:123",
                [SnubaQueryEventType.EventType.ERROR],
                False,
            )
            == "(event.type:error) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.ERROR,
                "release:123",
                [
                    SnubaQueryEventType.EventType.ERROR,
                    SnubaQueryEventType.EventType.DEFAULT,
                ],
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

    def test_event_types_discover(self) -> None:
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.ERROR,
                "release:123",
                [SnubaQueryEventType.EventType.ERROR],
                True,
            )
            == "(event.type:error) AND (release:123)"
        )
        assert (
            apply_dataset_query_conditions(
                SnubaQuery.Type.ERROR,
                "release:123",
                [
                    SnubaQueryEventType.EventType.ERROR,
                    SnubaQueryEventType.EventType.DEFAULT,
                ],
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
    def create_subscription(
        self, status: Any, subscription_id: Any = None, date_updated: Any = None
    ) -> Any:
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

    def test_create_update(self) -> None:
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


class RecheckBrokenSubscriptionTest(TestCase):
    @pytest.fixture(autouse=True)
    def _setup_metrics(self) -> object:
        with patch("sentry.snuba.tasks.metrics") as self.metrics:
            yield

    def create_subscription(
        self, status: QuerySubscription.Status, query: str, time_window: int = 60
    ) -> QuerySubscription:
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset=Dataset.Events.value,
            aggregate="count()",
            query=query,
            time_window=time_window,
            resolution=60,
        )
        return QuerySubscription.objects.create(
            snuba_query=snuba_query,
            status=status.value,
            project=self.project,
            type="something",
        )

    def test_still_broken(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.BROKEN, "issue:INVALID-1")
        recheck_broken_subscription(sub.id)
        sub.refresh_from_db()
        assert sub.status == QuerySubscription.Status.BROKEN.value
        self.metrics.incr.assert_called_once_with("snuba.subscriptions.broken.verified")

    def test_recovered(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.BROKEN, "hello")
        recheck_broken_subscription(sub.id)
        sub.refresh_from_db()
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None
        self.metrics.incr.assert_any_call("snuba.subscriptions.broken.recovered")

    def test_still_rejected_by_snuba(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.BROKEN, "hello", time_window=0)
        with patch("sentry.snuba.tasks.sentry_sdk.capture_exception") as capture_exception:
            recheck_broken_subscription(sub.id)
        sub.refresh_from_db()
        assert sub.status == QuerySubscription.Status.BROKEN.value
        assert sub.subscription_id is None
        capture_exception.assert_not_called()
        self.metrics.incr.assert_any_call("snuba.subscriptions.broken.verified")

    def test_concurrent_change_during_create(self) -> None:
        for status in (QuerySubscription.Status.DELETING, QuerySubscription.Status.BROKEN):
            sub = self.create_subscription(QuerySubscription.Status.BROKEN, "hello")

            def change_concurrently(subscription: QuerySubscription) -> str:
                QuerySubscription.objects.filter(id=subscription.id).update(
                    status=status.value, date_updated=timezone.now() + timedelta(seconds=1)
                )
                return f"1/{uuid4().hex}"

            with patch("sentry.snuba.tasks._create_in_snuba", side_effect=change_concurrently):
                recheck_broken_subscription(sub.id)
            sub.refresh_from_db()
            assert sub.status == status.value
            assert sub.subscription_id is None

    def test_not_broken(self) -> None:
        sub = self.create_subscription(QuerySubscription.Status.ACTIVE, "issue:INVALID-1")
        recheck_broken_subscription(sub.id)
        sub.refresh_from_db()
        assert sub.status == QuerySubscription.Status.ACTIVE.value
        self.metrics.incr.assert_not_called()


class ScheduleBrokenSubscriptionRechecksTest(TestCase):
    @patch("sentry.snuba.tasks.recheck_broken_subscription")
    def test_dispatches_broken(self, mock_recheck: Mock) -> None:
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset=Dataset.Events.value,
            aggregate="count()",
            query="hello",
            time_window=60,
            resolution=60,
        )
        broken = QuerySubscription.objects.create(
            snuba_query=snuba_query,
            status=QuerySubscription.Status.BROKEN.value,
            project=self.project,
            type="something",
        )
        QuerySubscription.objects.create(
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
            project=self.project,
            type="something",
        )
        schedule_broken_subscription_rechecks()
        mock_recheck.delay.assert_called_once_with(broken.id)
