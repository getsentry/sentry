import datetime
from unittest.mock import MagicMock, patch

import pytest
from celery.exceptions import SoftTimeLimitExceeded
from django.test import override_settings

from sentry.silo.base import SiloLimit, SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import test_tasks
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options


@instrumented_task(
    name="test.tasks.test_base.region_task",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(namespace=test_tasks),
)
def region_task(param):
    return f"Region task {param}"


@instrumented_task(
    name="test.tasks.test_base.control_task",
    silo_mode=SiloMode.CONTROL,
    taskworker_config=TaskworkerConfig(namespace=test_tasks),
)
def control_task(param):
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


@override_settings(
    CELERY_COMPLAIN_ABOUT_BAD_USE_OF_PICKLE=True,
    CELERY_PICKLE_ERROR_REPORT_SAMPLE_RATE=1.0,
)
@override_options(
    {
        "taskworker.enabled": False,
        "taskworker.route.overrides": {},
    }
)
@patch("sentry.tasks.base.metrics.distribution")
@freeze_time("2025-01-01 00:00:00")  # so size of params isn't impacted by current time.
def test_capture_payload_metrics(mock_distribution: MagicMock) -> None:
    region_task.apply_async(args=("bruh",))

    mock_distribution.assert_called_once_with(
        "celery.task.parameter_bytes",
        66,
        tags={"taskname": "test.tasks.test_base.region_task"},
        sample_rate=1.0,
    )


@override_settings(
    CELERY_COMPLAIN_ABOUT_BAD_USE_OF_PICKLE=True,
    CELERY_PICKLE_ERROR_REPORT_SAMPLE_RATE=1.0,
)
@override_options(
    {
        "taskworker.enabled": False,
        "taskworker.route.overrides": {},
    }
)
def test_validate_parameters_call() -> None:
    with pytest.raises(TypeError) as err:
        region_task.apply_async(args=(datetime.datetime.now(),))
    assert "region_task was called with a parameter that cannot be JSON encoded" in str(err)

    with pytest.raises(TypeError) as err:
        region_task.delay(datetime.datetime.now())
    assert "region_task was called with a parameter that cannot be JSON encoded" in str(err)

    with pytest.raises(TypeError) as err:
        region_task(datetime.datetime.now())
    assert "region_task was called with a parameter that cannot be JSON encoded" in str(err)


@override_settings(SILO_MODE=SiloMode.CONTROL)
@patch("sentry.taskworker.retry.current_task")
@patch("sentry_sdk.capture_exception")
def test_retry_on(capture_exception: MagicMock, current_task: MagicMock) -> None:
    class ExpectedException(Exception):
        pass

    current_task.retry.side_effect = ExpectedException("some exception")

    with pytest.raises(ExpectedException):
        retry_on_task("bruh")

    assert capture_exception.call_count == 1
    assert current_task.retry.call_count == 1


@pytest.mark.parametrize(
    "method_name",
    (
        "apply",
        "apply_async",
        "delay",
        "run",
        "s",
        "signature",
        "retry",
        "run",
    ),
)
@override_settings(SILO_MODE=SiloMode.CONTROL)
def test_task_silo_limit_celery_task_methods(method_name) -> None:
    method = getattr(region_task, method_name)
    with pytest.raises(SiloLimit.AvailabilityError):
        method("hi")


class ExpectedException(Exception):
    pass


@patch("sentry.taskworker.retry.current_task")
@patch("sentry_sdk.capture_exception")
def test_retry_timeout_enabled_taskbroker(capture_exception, current_task) -> None:
    current_task.retry.side_effect = ExpectedException("retry called")

    @retry(timeouts=True)
    def timeout_retry_task():
        raise ProcessingDeadlineExceeded()

    with pytest.raises(ExpectedException):
        timeout_retry_task()

    assert capture_exception.call_count == 1
    assert current_task.retry.call_count == 1


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


@patch("sentry.taskworker.retry.current_task")
@patch("sentry_sdk.capture_exception")
def test_retry_soft_timeout_enabled(capture_exception, current_task) -> None:
    current_task.retry.side_effect = ExpectedException("retry called")

    @retry(timeouts=True)
    def soft_timeout_retry_task():
        raise SoftTimeLimitExceeded()

    with pytest.raises(ExpectedException):
        soft_timeout_retry_task()

    assert capture_exception.call_count == 1
    assert current_task.retry.call_count == 1


@patch("sentry.taskworker.retry.current_task")
@patch("sentry_sdk.capture_exception")
def test_retry_soft_timeout_disabled(capture_exception, current_task) -> None:
    current_task.retry.side_effect = ExpectedException("retry called")

    @retry(on=(ValueError,), timeouts=False)
    def soft_timeout_retry_task():
        raise SoftTimeLimitExceeded()

    with pytest.raises(SoftTimeLimitExceeded):
        soft_timeout_retry_task()

    assert capture_exception.call_count == 0
    assert current_task.retry.call_count == 0


@patch("sentry.taskworker.retry.current_task")
@patch("sentry_sdk.capture_exception")
def test_retry_soft_timeouts_by_default(capture_exception, current_task) -> None:
    current_task.retry.side_effect = ExpectedException("retry called")

    @retry
    def soft_timeout_no_retry_task():
        raise SoftTimeLimitExceeded()

    with pytest.raises(ExpectedException):
        soft_timeout_no_retry_task()

    assert capture_exception.call_count == 1
    assert current_task.retry.call_count == 1
