import pytest
from django.test import override_settings
from taskbroker_client.constants import CompressionType
from taskbroker_client.registry import TaskRegistry
from taskbroker_client.retry import Retry

from sentry.silo.base import SiloLimit, SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.adapters import SentryMetricsBackend, SentryRouter, make_producer
from sentry.taskworker.namespaces import exampletasks, test_tasks


@instrumented_task(
    name="test.tasks.test_base.region_task",
    namespace=test_tasks,
    silo_mode=SiloMode.CELL,
)
def region_task(param) -> str:
    return f"Region task {param}"


@instrumented_task(
    name="test.tasks.test_base.control_task",
    namespace=test_tasks,
    silo_mode=SiloMode.CONTROL,
)
def control_task(param) -> str:
    return f"Control task {param}"


@instrumented_task(
    name="tests.tasks.test_base.primary_task",
    namespace=test_tasks,
    alias="tests.tasks.test_base.alias_task",
)
def task_with_alias(param) -> str:
    return f"Task with alias {param}"


@instrumented_task(
    name="tests.tasks.test_base.region_primary_task",
    namespace=test_tasks,
    alias="tests.tasks.test_base.region_alias_task",
    retry=Retry(times=3, on=(Exception,)),
    silo_mode=SiloMode.CELL,
)
def region_task_with_alias(param) -> str:
    return f"Region task with alias {param}"


@instrumented_task(
    name="tests.tasks.test_base.control_primary_task",
    namespace=test_tasks,
    alias="tests.tasks.test_base.control_alias_task",
    silo_mode=SiloMode.CONTROL,
)
def control_task_with_alias(param) -> str:
    return f"Control task with alias {param}"


@instrumented_task(
    name="tests.tasks.test_base.primary_task_primary_namespace",
    namespace=test_tasks,
    alias="tests.tasks.test_base.alias_task_alias_namespace",
    alias_namespace=exampletasks,
)
def task_with_alias_and_alias_namespace(param) -> str:
    return f"Task with alias and alias namespace {param}"


@override_settings(SILO_MODE=SiloMode.CELL)
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


@pytest.mark.parametrize(
    "method_name",
    ("apply_async", "delay"),
)
@override_settings(SILO_MODE=SiloMode.CONTROL)
def test_task_silo_limit_task_methods(method_name: str) -> None:
    method = getattr(region_task, method_name)
    with pytest.raises(SiloLimit.AvailabilityError):
        method("hi")


def test_instrumented_task_parameters() -> None:
    registry = TaskRegistry(
        application="sentry",
        producer_factory=make_producer,
        router=SentryRouter(),
        metrics=SentryMetricsBackend(),
    )
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


def test_instrumented_task_with_alias_same_namespace() -> None:
    assert test_tasks.contains("tests.tasks.test_base.primary_task")
    assert task_with_alias("test") == "Task with alias test"

    assert test_tasks.contains("tests.tasks.test_base.alias_task")
    assert test_tasks.get("tests.tasks.test_base.alias_task")("test") == "Task with alias test"


def test_instrumented_task_with_alias_different_namespaces() -> None:
    assert test_tasks.contains("tests.tasks.test_base.primary_task_primary_namespace")
    task_result = task_with_alias_and_alias_namespace("test")
    assert task_result == "Task with alias and alias namespace test"

    assert exampletasks.contains("tests.tasks.test_base.alias_task_alias_namespace")
    assert (
        exampletasks.get("tests.tasks.test_base.alias_task_alias_namespace")("test")
        == "Task with alias and alias namespace test"
    )


@override_settings(SILO_MODE=SiloMode.CELL)
def test_instrumented_task_with_alias_silo_limit_call_region() -> None:
    assert test_tasks.contains("tests.tasks.test_base.region_primary_task")
    assert region_task_with_alias("test") == "Region task with alias test"

    assert test_tasks.contains("tests.tasks.test_base.region_alias_task")
    assert (
        test_tasks.get("tests.tasks.test_base.region_alias_task")("test")
        == "Region task with alias test"
    )

    assert test_tasks.contains("tests.tasks.test_base.control_primary_task")
    with pytest.raises(SiloLimit.AvailabilityError):
        control_task_with_alias("test")

    assert test_tasks.contains("tests.tasks.test_base.control_alias_task")
    with pytest.raises(SiloLimit.AvailabilityError):
        test_tasks.get("tests.tasks.test_base.control_alias_task")("test")


@override_settings(SILO_MODE=SiloMode.CONTROL)
def test_instrumented_task_with_alias_silo_limit_call_control() -> None:
    assert test_tasks.contains("tests.tasks.test_base.region_primary_task")
    with pytest.raises(SiloLimit.AvailabilityError):
        region_task_with_alias("test")

    assert test_tasks.contains("tests.tasks.test_base.region_alias_task")
    with pytest.raises(SiloLimit.AvailabilityError):
        test_tasks.get("tests.tasks.test_base.region_alias_task")("test")
