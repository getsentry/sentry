from unittest.mock import patch

import pytest
from django.test import override_settings

from sentry.silo.base import SiloLimit, SiloMode
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(name="test.tasks.test_base.region_task", silo_mode=SiloMode.REGION)
def region_task(param):
    return f"Region task {param}"


@instrumented_task(name="test.tasks.test_base.control_task", silo_mode=SiloMode.CONTROL)
def control_task(param):
    return f"Control task {param}"


@retry(ignore_and_capture=(Exception,))
@instrumented_task(name="test.tasks.test_base.ignore_and_capture_task", silo_mode=SiloMode.CONTROL)
def ignore_and_capture_retry_task(param):
    raise Exception(param)


@retry(on=(Exception,))
@instrumented_task(name="test.tasks.test_base.retry_task", silo_mode=SiloMode.CONTROL)
def retry_on_task(param):
    raise Exception(param)


@retry(ignore=(Exception,))
@instrumented_task(name="test.tasks.test_base.ignore_task", silo_mode=SiloMode.CONTROL)
def ignore_on_exception_task(param):
    raise Exception(param)


@retry(exclude=(Exception,))
@instrumented_task(name="test.tasks.test_base.exclude_task", silo_mode=SiloMode.CONTROL)
def exclude_on_exception_task(param):
    raise Exception(param)


@override_settings(SILO_MODE=SiloMode.REGION)
def test_task_silo_limit_call_region():
    result = region_task("hi")
    assert "Region task hi" == result

    with pytest.raises(SiloLimit.AvailabilityError):
        control_task("hi")


@override_settings(SILO_MODE=SiloMode.CONTROL)
def test_task_silo_limit_call_control():
    with pytest.raises(SiloLimit.AvailabilityError):
        region_task("hi")

    assert "Control task hi" == control_task("hi")


@override_settings(SILO_MODE=SiloMode.MONOLITH)
def test_task_silo_limit_call_monolith():
    assert "Region task hi" == region_task("hi")
    assert "Control task hi" == control_task("hi")


@patch("sentry.tasks.base.capture_exception")
def test_ignore_and_retry(capture_exception):
    ignore_and_capture_retry_task("bruh")

    assert capture_exception.call_count == 1


@patch("sentry.tasks.base.capture_exception")
def test_ignore_exception_retry(capture_exception):
    ignore_on_exception_task("bruh")

    assert capture_exception.call_count == 0


@patch("sentry.tasks.base.capture_exception")
def test_exclude_exception_retry(capture_exception):
    with pytest.raises(Exception):
        exclude_on_exception_task("bruh")

    assert capture_exception.call_count == 0


@patch("sentry.tasks.base.current_task")
@patch("sentry.tasks.base.capture_exception")
def test_retry_on(capture_exception, current_task):

    # In reality current_task.retry will cause the given exception to be re-raised but we patch it here so no need to .raises :bufo-shrug:
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
def test_task_silo_limit_celery_task_methods(method_name):
    method = getattr(region_task, method_name)
    with pytest.raises(SiloLimit.AvailabilityError):
        method("hi")
