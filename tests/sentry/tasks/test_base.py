import pytest
from django.test import override_settings

from sentry.silo.base import SiloLimit, SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(name="test.tasks.test_base.region_task", silo_mode=SiloMode.REGION)
def region_task(param):
    return f"Region task {param}"


@instrumented_task(name="test.tasks.test_base.control_task", silo_mode=SiloMode.CONTROL)
def control_task(param):
    return f"Control task {param}"


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
