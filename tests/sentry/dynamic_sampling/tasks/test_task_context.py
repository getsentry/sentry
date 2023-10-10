import time

from sentry.dynamic_sampling.tasks.task_context import DynamicSamplingLogState, TaskContext, Timers
from sentry.testutils.helpers.datetime import freeze_time


def test_task_context_expiration_time():
    """
    Tests that the TaskContext properly initialises the expiration_time
    """
    with freeze_time("2023-07-12 10:00:00"):
        context = TaskContext("my-task", 3)
        # expiration should be 3 seconds from now
        assert context.expiration_time == time.monotonic() + 3


def test_task_context_data():
    """
    Tests that TaskContext properly handles function contexts

    * it deals with defaults and missing values
    * it sets and retrieves values correctly
    * it keeps various function contexts separated from each other
    """
    context = TaskContext("my-task", 3)
    assert context.get_function_state("func1") == DynamicSamplingLogState()

    context.set_function_state("func1", DynamicSamplingLogState(num_rows_total=1, num_db_calls=2))
    assert context.get_function_state("func1") == DynamicSamplingLogState(
        num_rows_total=1, num_db_calls=2
    )
    assert context.get_function_state("func2") == DynamicSamplingLogState()

    context.set_function_state(
        "func2",
        DynamicSamplingLogState(
            num_rows_total=1,
            num_db_calls=2,
            num_iterations=3,
            num_projects=4,
            num_orgs=5,
            execution_time=2.3,
        ),
    )
    assert context.get_function_state("func1") == DynamicSamplingLogState(
        num_rows_total=1, num_db_calls=2
    )
    assert context.get_function_state("func2") == DynamicSamplingLogState(
        num_rows_total=1,
        num_db_calls=2,
        num_iterations=3,
        num_projects=4,
        num_orgs=5,
        execution_time=2.3,
    )


def test_timer_raw():
    """
    Tests the direct functionality of Timer (i.e. not as a context manager)
    """

    t = Timers().get_timer("a")
    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        # timer is not started, so it should have a 0 interval
        assert t.current() == 0

        t.start()
        t.stop()
        # no time has passed
        assert t.current() == 0

        t.start()
        # still no time passed
        assert t.current() == 0
        t.stop()

        # jump 1 second in the future
        frozen_time.shift(1)

        # the timer is stopped so nothing should have happened
        assert t.current() == 0

        # stopping and starting should not do anything either since no time
        # is advancing at the moment
        t.start()
        assert t.current() == 0
        t.stop()
        assert t.current() == 0

        # start and jump another second
        t.start()

        # another sec
        frozen_time.shift(1)

        # now the timer should be at 1 sec
        assert t.current() == 1.0

        # stopping and starting it at this point should still be at 1 sec
        t.start()
        assert t.current() == 1.0
        t.stop()
        assert t.current() == 1.0
        t.start()
        assert t.current() == 1.0
        t.stop()
        assert t.current() == 1.0

        frozen_time.shift(1)
        # check that we can accumulate multiple stops and starts
        assert t.current() == 1.0
        t.start()
        assert t.current() == 1.0

        # another sec
        frozen_time.shift(1)

        assert t.current() == 2.0
        t.stop()
        assert t.current() == 2.0
        t.start()
        assert t.current() == 2.0
        t.stop()
        assert t.current() == 2.0


def test_named_timer_raw():
    """
    Tests the direct functionality of Timer (i.e. not as a context manager)
    with named timers
    """

    t = Timers()
    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        # timer is not started, so it should have a 0 interval
        ta = t.get_timer("a")
        tb = t.get_timer("b")
        tc = t.get_timer("c")
        assert ta.current() == 0
        assert tb.current() == 0
        assert tc.current() == 0

        ta.start()
        ta.stop()
        tc.start()
        # no time has passed
        assert ta.current() == 0
        assert tb.current() == 0
        assert tc.current() == 0

        ta.start()
        # still no time passed
        assert ta.current() == 0
        assert tb.current() == 0
        assert tc.current() == 0
        ta.stop()

        # jump 1 second in the future
        frozen_time.shift(1)

        # the timer is stopped for a&b so nothing should have happened
        assert ta.current() == 0
        assert tb.current() == 0
        # for c we should have 1 sec
        assert tc.current() == 1

        # stopping and starting should not do anything either since no time
        # is advancing at the moment
        ta.start()
        assert ta.current() == 0
        assert tb.current() == 0
        assert tc.current() == 1
        ta.stop()
        assert ta.current() == 0
        assert tb.current() == 0
        assert tc.current() == 1

        # start and jump another second
        ta.start()

        # another sec
        frozen_time.shift(1)

        # now the timer should be at 1 sec
        assert ta.current() == 1.0
        assert tb.current() == 0.0
        assert tc.current() == 2.0

        # stopping and starting it at this point should still be at 1 sec
        ta.start()
        assert ta.current() == 1.0
        assert tb.current() == 0.0
        assert tc.current() == 2.0
        ta.stop()
        assert ta.current() == 1.0
        assert tb.current() == 0.0
        assert tc.current() == 2.0
        tb.start()

        frozen_time.shift(1)
        # check that we can accumulate multiple stops and starts
        assert ta.current() == 1.0
        assert tb.current() == 1.0
        assert tc.current() == 3.0
        ta.start()
        assert ta.current() == 1.0
        assert tb.current() == 1.0
        assert tc.current() == 3.0

        # another sec
        frozen_time.shift(1)

        assert ta.current() == 2.0
        assert tb.current() == 2.0
        assert tc.current() == 4.0
        ta.stop()
        assert ta.current() == 2.0
        assert tb.current() == 2.0
        assert tc.current() == 4.0

        # another sec
        frozen_time.shift(1)

        assert ta.current() == 2.0
        assert tb.current() == 3.0
        assert tc.current() == 5.0


def test_timer_context_manager():
    """
    Tests the context manager functionality of the timer
    """
    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        t = Timers()
        for i in range(3):
            with t.get_timer("a"):
                # only the seconds advanced within the counter should be counted
                assert t.current("a") == i

                # jump one sec
                frozen_time.shift(1)
            frozen_time.shift(1)

        # we advanced 3 seconds within the timer and 3 outside we should have only counted 3
        assert t.current("a") == 3


def test_named_timer_context_manager():
    """
    Tests the context manager functionality of the timer
    """
    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        t = Timers()

        for i in range(3):
            with t.get_timer("global") as t_global:
                assert t_global.current() == i * 7
                # only the seconds advanced within the counter should be counted
                assert t.current("global") == i * 7  # i*1 +i*2 * i*3 + i*1 = i*7

                with t.get_timer("a") as ta:
                    assert ta.current() == i
                    frozen_time.shift(1)
                with t.get_timer("b") as tb:
                    assert tb.current() == i * 2
                    frozen_time.shift(2)
                with t.get_timer("c") as tc:
                    assert tc.current() == i * 3
                    frozen_time.shift(3)

                # jump one sec
                frozen_time.shift(1)

            frozen_time.shift(1)

        # outside the context manager timers should not advance
        frozen_time.shift(100)

        assert t.current("a") == 3
        assert t.current("b") == 3 * 2
        assert t.current("c") == 3 * 3
        assert t.current("global") == 3 * 7


def test_task_context_serialisation():
    task = TaskContext("my-task", 100)
    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        # a timer without state
        with task.get_timer("a"):
            frozen_time.shift(1)
        # a timer with state
        with task.get_timer("b"):
            frozen_time.shift(2)
            state = task.get_function_state("b")
            state.num_iterations = 1
            state.num_orgs = 2
            state.num_projects = 3
            state.num_db_calls = 4
            state.num_rows_total = 5
            task.set_function_state("b", state)
        # some state without a timer
        state = task.get_function_state("c")
        state.num_iterations = 1
        task.set_function_state("c", state)

    result = task.to_dict()
    # remove "seconds" since we can't control it
    del result["seconds"]
    assert result == {
        "maxSeconds": 100,
        "taskName": "my-task",
        "taskData": {
            "a": {
                "executionTime": 1.0,
                "numDbCalls": 0,
                "numIterations": 0,
                "numOrgs": 0,
                "numProjects": 0,
                "numRowsTotal": 0,
            },
            "b": {
                "executionTime": 2.0,
                "numDbCalls": 4,
                "numIterations": 1,
                "numOrgs": 2,
                "numProjects": 3,
                "numRowsTotal": 5,
            },
            "c": {
                "executionTime": 0,
                "numDbCalls": 0,
                "numIterations": 1,
                "numOrgs": 0,
                "numProjects": 0,
                "numRowsTotal": 0,
            },
        },
    }
