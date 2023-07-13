import time

from freezegun import freeze_time

from sentry.dynamic_sampling.tasks.task_context import DynamicSamplingLogState, TaskContext


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
