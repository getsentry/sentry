from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from sentry.dynamic_sampling.tasks.common import GetActiveOrgs, TimedIterator, TimeoutException
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.snuba.metrics import TransactionMRI
from sentry.testutils import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.utils.types import Any

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


def test_timeout_exception():
    """
    Test creation of exception
    """

    context = TaskContext("my_context", 3)
    # test we can create an exception (with additional args)
    ex = TimeoutException(context, 23)
    assert ex.task_context == context
    ex = TimeoutException(task_context=context)
    assert ex.task_context == context


class FakeContextIterator:
    def __init__(self, frozen_time: Any, tick_seconds):
        self.count = 0
        self.frozen_time = frozen_time
        self.tick_seconds = tick_seconds

    def __iter__(self):
        return self

    def __next__(self):
        if self.count < 2:
            self.count += 1
            self.frozen_time.tick(delta=timedelta(seconds=self.tick_seconds))
            return self.count
        raise StopIteration()

    def get_current_state(self):
        return self.count


def test_timed_iterator_no_timout():

    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        context = TaskContext("my_context", 3)
        it = TimedIterator(context, "ti1", FakeContextIterator(frozen_time, 1))
        # should iterate while there is no timeout
        assert (next(it)) == 1
        assert context.get_current_context("ti1") == {"data": 1, "executionTime": 1}
        assert (next(it)) == 2
        assert context.get_current_context("ti1") == {"data": 2, "executionTime": 2}
        with pytest.raises(StopIteration):
            next(it)


def test_timed_iterator_with_timeout():
    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        context = TaskContext("my_context", 3)
        it = TimedIterator(context, "ti1", FakeContextIterator(frozen_time, 4))
        # should iterate while there is no timeout
        assert (next(it)) == 1
        assert context.get_current_context("ti1") == {"data": 1, "executionTime": 4.0}
        # the next iteration will be at 4 seconds which is over time and should raise
        with pytest.raises(TimeoutException):
            next(it)


@freeze_time(MOCK_DATETIME)
class TestGetActiveOrgs(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    def setUp(self):

        # create 10 orgs each with 10 transactions
        for i in range(10):
            org = self.create_organization(f"org-{i}")
            for i in range(10):
                project = self.create_project(organization=org)
                self.store_performance_metric(
                    name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={"transaction": "foo_transaction", "decision": "keep"},
                    minutes_before_now=30,
                    value=1,
                    project_id=project.id,
                    org_id=org.id,
                )

    @property
    def now(self):
        return MOCK_DATETIME

    def test_get_active_orgs_no_max_projects(self):
        total_orgs = 0
        for idx, orgs in enumerate(GetActiveOrgs(3)):
            num_orgs = len(orgs)
            total_orgs += num_orgs
            if idx in [0, 1, 2]:
                assert num_orgs == 3  # first batch should be full
            else:
                assert num_orgs == 1  # second should contain the remaining 3
        assert total_orgs == 10

    def test_get_active_orgs_with_max_projects(self):
        total_orgs = 0
        for orgs in GetActiveOrgs(3, 18):
            # we ask for max 18 proj (that's 2 org per request since one org has 10 )
            num_orgs = len(orgs)
            total_orgs += num_orgs
            assert num_orgs == 2  # only 2 orgs since we limit the number of projects
        assert total_orgs == 10
