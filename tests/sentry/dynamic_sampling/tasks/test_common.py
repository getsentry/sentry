from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.dynamic_sampling.tasks.common import (
    GetActiveOrgs,
    GetActiveOrgsVolumes,
    OrganizationDataVolume,
    TimedIterator,
    TimeoutException,
    get_organization_volume,
    timed_function,
)
from sentry.dynamic_sampling.tasks.task_context import DynamicSamplingLogState, TaskContext
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time

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
    def __init__(self, frozen_time, tick_seconds):
        self.count = 0
        self.frozen_time = frozen_time
        self.tick_seconds = tick_seconds

    def __iter__(self):
        return self

    def __next__(self):
        if self.count < 2:
            self.count += 1
            self.frozen_time.shift(self.tick_seconds)
            return self.count
        raise StopIteration()

    def get_current_state(self):
        return DynamicSamplingLogState(num_iterations=self.count)

    def set_current_state(self, state: DynamicSamplingLogState):
        self.count = state.num_iterations


def test_timed_iterator_no_timout():

    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        context = TaskContext("my_context", 3)
        it = TimedIterator(context, FakeContextIterator(frozen_time, 1), "ti1")
        # should iterate while there is no timeout
        assert (next(it)) == 1
        assert context.get_function_state("ti1") == DynamicSamplingLogState(
            num_rows_total=0,
            num_db_calls=0,
            num_iterations=1,
            num_projects=0,
            num_orgs=0,
            execution_time=1.0,
        )
        assert (next(it)) == 2
        assert context.get_function_state("ti1") == DynamicSamplingLogState(
            num_rows_total=0,
            num_db_calls=0,
            num_iterations=2,
            num_projects=0,
            num_orgs=0,
            execution_time=2.0,
        )
        with pytest.raises(StopIteration):
            next(it)


def test_timed_iterator_with_timeout():
    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        context = TaskContext("my_context", 3)
        it = TimedIterator(context, FakeContextIterator(frozen_time, 4), "ti1")
        # should iterate while there is no timeout
        assert (next(it)) == 1
        assert context.get_function_state("ti1") == DynamicSamplingLogState(
            num_rows_total=0,
            num_db_calls=0,
            num_iterations=1,
            num_projects=0,
            num_orgs=0,
            execution_time=4.0,
        )
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


def test_timed_function_decorator_updates_state():
    """
    Tests that the decorator correctly extracts the state
    and passes it to the inner function.

    At the end the Context should be properly updated for the wrapped function
    It works with the default function name and also with custom names

    """
    context = TaskContext(name="TC", num_seconds=60.0)

    @timed_function()
    def f1(state: DynamicSamplingLogState, x: int, y: str):
        state.num_iterations = 1

    @timed_function("f2x")
    def f2(state: DynamicSamplingLogState, x: int, y: str):
        state.num_iterations = 2

    f1(context, 1, "x")
    f2(context, 1, "x")

    f1_state = context.get_function_state("f1")
    assert f1_state is not None
    assert f1_state.num_iterations == 1

    f2_state = context.get_function_state("f2x")
    assert f2_state is not None
    assert f2_state.num_iterations == 2


def test_timed_function_correctly_times_inner_function():
    with freeze_time("2023-07-14 10:00:00") as frozen_time:
        context = TaskContext(name="TC", num_seconds=60.0)

        @timed_function()
        def f1(state: DynamicSamplingLogState, x: int, y: str):
            state.num_iterations = 1
            frozen_time.shift(1)

        f1(context, 1, "x")
        frozen_time.shift(1)
        f1(context, 1, "x")

        # two seconds passed inside f1 ( one for each call)
        t = context.get_timer("f1")
        assert t.current() == 2.0


def test_timed_function_correctly_raises_when_task_expires():
    with freeze_time("2023-07-14 10:00:00") as frozen_time:
        context = TaskContext(name="TC", num_seconds=2.0)

        @timed_function()
        def f1(state: DynamicSamplingLogState, x: int, y: str):
            state.num_iterations = 1
            frozen_time.shift(1)

        f1(context, 1, "x")
        t = context.get_timer("f1")
        assert t.current() == 1.0
        frozen_time.shift(1)
        assert t.current() == 1.0  # timer should not be moving ouside the function
        f1(context, 1, "x")

        # two seconds passed inside f1 ( one for each call)
        assert t.current() == 2.0

        with pytest.raises(TimeoutException):
            f1(context, 1, "x")

        # the tick should not advance ( the function should not have been called)
        assert t.current() == 2.0


NOW_ISH = timezone.now().replace(second=0, microsecond=0)


@freeze_time(MOCK_DATETIME)
class TestGetActiveOrgsVolumes(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    def setUp(self):
        self.orgs = []
        # create 12 orgs each and some transactions with a 2/1 drop/keep rate
        for i in range(12):
            org = self.create_organization(f"org-{i}")
            self.orgs.append(org)
            project = self.create_project(organization=org)
            for decision, value in [("drop", 2), ("keep", 1)]:
                self.store_performance_metric(
                    name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={"transaction": "foo_transaction", "decision": decision},
                    minutes_before_now=1,
                    value=value,
                    project_id=project.id,
                    org_id=org.id,
                )

    @property
    def now(self):
        return MOCK_DATETIME

    def test_get_active_orgs_volumes_exact_batch_match(self):
        """
        gets active org volumes, with a batch size multiple of
        number of elements
        """
        total_orgs = 0
        for orgs in GetActiveOrgsVolumes(max_orgs=3):
            num_orgs = len(orgs)
            total_orgs += num_orgs
            assert num_orgs == 3  # first batch should be full
            for org in orgs:
                assert org.total == 3
                assert org.indexed == 1
        assert total_orgs == 12

    def test_get_active_orgs_volumes(self):
        """
        gets active org volumes, with a batch size that is not a multiple
        of the number of elements in the DB
        """
        total_orgs = 0
        for idx, orgs in enumerate(GetActiveOrgsVolumes(max_orgs=5)):
            num_orgs = len(orgs)
            total_orgs += num_orgs
            if idx in [0, 1]:
                assert num_orgs == 5  # first two batches should be full
            elif idx == 2:
                assert num_orgs == 2  # last batch not full
            else:
                pytest.fail(f"Unexpected index {idx} only 3 iterations expected.")
            for org in orgs:
                assert org.total == 3
                assert org.indexed == 1

        assert total_orgs == 12

    def test_get_organization_volume_existing_org(self):
        """
        gets the volume of one existing organization
        """
        org = self.orgs[0]
        org_volume = get_organization_volume(org.id)
        assert org_volume == OrganizationDataVolume(org_id=org.id, total=3, indexed=1)

    def test_get_organization_volume_missing_org(self):
        """
        calls get_organization_volume for a missing org (should return None)
        """
        org_id = 99999999  # can we do better, an id we know for sure is not in the DB?
        org_volume = get_organization_volume(org_id)
        assert org_volume is None
