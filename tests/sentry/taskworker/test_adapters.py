import pytest
from django.test.utils import override_settings
from taskbroker_client.registry import TaskRegistry

from sentry.conf.types.kafka_definition import Topic
from sentry.silo.base import SiloMode
from sentry.taskworker.adapters import SentryMetricsBackend, SentryRouter, make_producer


@pytest.mark.django_db
def test_registry_create_namespace_route_setting() -> None:
    with override_settings(TASKWORKER_ROUTES='{"profiling":"profiles", "lol":"nope"}'):
        registry = TaskRegistry(
            application="sentry",
            producer_factory=make_producer,
            router=SentryRouter(),
            metrics=SentryMetricsBackend(),
        )

        # namespaces without routes resolve to the default topic.
        tests = registry.create_namespace(name="tests")
        assert tests.topic == Topic.TASKWORKER.value

        profiling = registry.create_namespace(name="profiling")
        assert profiling.topic == Topic.PROFILES.value

        with pytest.raises(ValueError):
            ns = registry.create_namespace(name="lol")
            # Should raise as the name is routed to an invalid topic
            ns.topic


@pytest.mark.django_db
def test_default_router_topic() -> None:
    router = SentryRouter()
    topic = router.route_namespace("test.tasks.test_router.default")
    assert topic == Topic.TASKWORKER.value


@pytest.mark.django_db
def test_default_router_topic_region_silo() -> None:
    with override_settings(SILO_MODE=SiloMode.CELL):
        router = SentryRouter()
        topic = router.route_namespace("test.tasks.test_router.region")
        assert topic == Topic.TASKWORKER.value


@pytest.mark.django_db(databases=["default", "control"])
def test_default_router_topic_control_silo() -> None:
    with override_settings(SILO_MODE=SiloMode.CONTROL):
        router = SentryRouter()
        topic = router.route_namespace("test.tasks.test_router.control")
        assert topic == Topic.TASKWORKER_CONTROL.value
