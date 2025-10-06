from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings

from sentry.silo.base import SiloLimit, SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.constants import CompressionType
from sentry.taskworker.namespaces import test_tasks
from sentry.taskworker.registry import TaskRegistry
from sentry.taskworker.retry import Retry, RetryError
from sentry.taskworker.state import CurrentTaskState
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded


@instrumented_task(
    name="test.tasks.test_base.region_task",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(namespace=test_tasks),
)
def region_task(param) -> str:
    return f"Region task {param}"


@instrumented_task(
    name="test.tasks.test_base.control_task",
    silo_mode=SiloMode.CONTROL,
    taskworker_config=TaskworkerConfig(namespace=test_tasks),
)
def control_task(param) -> str:
    return f"Control task {param}"


@retry(ignore_and_capture=(Exception,))
@instrumented_task(
    name="test.tasks.test_base.ignore_and_capture_task",
    silo_mode=SiloMode.CONTROL,
    taskworker_config=TaskworkerConfig(namespace=test_tasks),
)
def ignore_and_capture_retry_task(param):
    raise Exception(param)


@instrumented_task(
    name="test.tasks.test_base.retry_task",
    silo_mode=SiloMode.CONTROL,
    taskworker_config=TaskworkerConfig(namespace=test_tasks),
)
@retry(on=(Exception,))
def retry_on_task(param):
    raise Exception(param)


@retry(ignore=(Exception,))
@instrumented_task(
    name="test.tasks.test_base.ignore_task",
    silo_mode=SiloMode.CONTROL,
    taskworker_config=TaskworkerConfig(namespace=test_tasks),
)
def ignore_on_exception_task(param):
    raise Exception(param)


@retry(exclude=(Exception,))
@instrumented_task(
    name="test.tasks.test_base.exclude_task",
    silo_mode=SiloMode.CONTROL,
    taskworker_config=TaskworkerConfig(namespace=test_tasks),
)
def exclude_on_exception_task(param):
    raise Exception(param)


@override_settings(SILO_MODE=SiloMode.REGION)
def test_task_silo_limit_call_region() -> None:
    result = region_task("hi")
    assert "Region task hi" == result

    with pytest.raises(SiloLimit.AvailabilityError):
        control_task("hi")


@override_settings(SILO_MODE=SiloMode.CONTROL)
def test_task_silo_limit_call_control() -> None:
    with pytest.raises(SiloLimit.AvailabilityError):
        region_task("hi")

    assert "Control task hi" == control_task("hi")


@override_settings(SILO_MODE=SiloMode.MONOLITH)
def test_task_silo_limit_call_monolith() -> None:
    assert "Region task hi" == region_task("hi")
    assert "Control task hi" == control_task("hi")


@patch("sentry_sdk.capture_exception")
def test_ignore_and_retry(capture_exception: MagicMock) -> None:
    ignore_and_capture_retry_task("bruh")

    assert capture_exception.call_count == 1


@patch("sentry_sdk.capture_exception")
def test_ignore_exception_retry(capture_exception: MagicMock) -> None:
    ignore_on_exception_task("bruh")

    assert capture_exception.call_count == 0


@patch("sentry_sdk.capture_exception")
def test_exclude_exception_retry(capture_exception: MagicMock) -> None:
    with pytest.raises(Exception):
        exclude_on_exception_task("bruh")

    assert capture_exception.call_count == 0


@override_settings(SILO_MODE=SiloMode.CONTROL)
@patch("sentry_sdk.capture_exception")
def test_retry_on(capture_exception: MagicMock) -> None:
    with pytest.raises(RetryError):
        retry_on_task("bruh")

    assert capture_exception.call_count == 1


@pytest.mark.parametrize(
    "method_name",
    ("apply_async", "delay"),
)
@override_settings(SILO_MODE=SiloMode.CONTROL)
def test_task_silo_limit_task_methods(method_name: str) -> None:
    method = getattr(region_task, method_name)
    with pytest.raises(SiloLimit.AvailabilityError):
        method("hi")


class ExpectedException(Exception):
    pass


@patch("sentry_sdk.capture_exception")
def test_retry_timeout_enabled_taskbroker(capture_exception) -> None:
    @retry(timeouts=True)
    def timeout_retry_task():
        raise ProcessingDeadlineExceeded()

    with pytest.raises(RetryError):
        timeout_retry_task()

    assert capture_exception.call_count == 1


@patch("sentry.taskworker.retry.current_task")
@patch("sentry_sdk.capture_exception")
def test_retry_timeout_disabled_taskbroker(capture_exception, current_task) -> None:

    @retry(timeouts=False)
    def timeout_no_retry_task():
        raise ProcessingDeadlineExceeded()

    with pytest.raises(ProcessingDeadlineExceeded):
        timeout_no_retry_task()

    assert capture_exception.call_count == 0
    assert current_task.retry.call_count == 0


@patch("sentry_sdk.capture_exception")
def test_retry_timeout_enabled(capture_exception) -> None:
    @retry(timeouts=True)
    def soft_timeout_retry_task():
        raise ProcessingDeadlineExceeded()

    with pytest.raises(RetryError):
        soft_timeout_retry_task()

    assert capture_exception.call_count == 1


@patch("sentry.taskworker.retry.current_task")
@patch("sentry_sdk.capture_exception")
def test_retry_timeout_disabled(capture_exception, current_task) -> None:
    current_task.retry.side_effect = ExpectedException("retry called")

    @retry(on=(ValueError,), timeouts=False)
    def soft_timeout_retry_task():
        raise ProcessingDeadlineExceeded()

    with pytest.raises(ProcessingDeadlineExceeded):
        soft_timeout_retry_task()

    assert capture_exception.call_count == 0
    assert current_task.retry.call_count == 0


def test_instrumented_task_parameters() -> None:
    registry = TaskRegistry()
    namespace = registry.create_namespace("registertest")

    @instrumented_task(
        name="hello_task",
        namespace=namespace,
        retry=Retry(times=3, on=(RuntimeError,)),
        processing_deadline_duration=60,
        compression_type=CompressionType.ZSTD,
    )
    def hello_task():
        pass

    decorated = namespace.get("hello_task")
    assert decorated
    assert decorated.compression_type == CompressionType.ZSTD
    assert decorated.retry
    assert decorated.retry._times == 3
    assert decorated.retry._allowed_exception_types == (RuntimeError,)


@patch("sentry.tasks.base.current_task")
def test_retry_raise_if_no_retries_false(mock_current_task):
    mock_task_state = MagicMock(spec=CurrentTaskState)
    mock_task_state.retries_remaining = False
    mock_current_task.return_value = mock_task_state

    @retry(on=(Exception,), raise_on_no_retries=False)
    def task_that_raises_retry_error():
        raise RetryError("try again")

    # No exception.
    task_that_raises_retry_error()

    mock_task_state.retries_remaining = True
    with pytest.raises(RetryError):
        task_that_raises_retry_error()
