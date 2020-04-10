from __future__ import absolute_import

import abc
import json
from uuid import uuid4

import responses
from exam import patcher
from mock import Mock, patch
from six import add_metaclass

from sentry.snuba.models import QueryAggregations, QueryDatasets, QuerySubscription
from sentry.snuba.tasks import (
    create_subscription_in_snuba,
    update_subscription_in_snuba,
    delete_subscription_from_snuba,
)
from sentry.testutils import TestCase


@add_metaclass(abc.ABCMeta)
class BaseSnubaTaskTest(object):
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

    def create_subscription(self, status=None, subscription_id=None):
        if status is None:
            status = self.expected_status
        return QuerySubscription.objects.create(
            status=status.value,
            subscription_id=subscription_id,
            project=self.project,
            type="something",
            dataset=QueryDatasets.EVENTS.value,
            query="hello",
            aggregation=QueryAggregations.UNIQUE_USERS.value,
            time_window=60,
            resolution=60,
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
        subscription_id = "1/{}".format(uuid4().hex)
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
        subscription_id = "1/{}".format(uuid4().hex)
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
