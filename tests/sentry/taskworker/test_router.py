from typing import int
import pytest
from django.test.utils import override_settings

from sentry.conf.types.kafka_definition import Topic
from sentry.silo.base import SiloMode
from sentry.taskworker.router import DefaultRouter


@pytest.mark.django_db
def test_default_router_topic() -> None:
    router = DefaultRouter()
    topic = router.route_namespace("test.tasks.test_router.default")
    assert topic == Topic.TASKWORKER


@pytest.mark.django_db
def test_default_router_topic_region_silo() -> None:
    with override_settings(SILO_MODE=SiloMode.REGION):
        router = DefaultRouter()
        topic = router.route_namespace("test.tasks.test_router.region")
        assert topic == Topic.TASKWORKER


@pytest.mark.django_db(databases=["default", "control"])
def test_default_router_topic_control_silo() -> None:
    with override_settings(SILO_MODE=SiloMode.CONTROL):
        router = DefaultRouter()
        topic = router.route_namespace("test.tasks.test_router.control")
        assert topic == Topic.TASKWORKER_CONTROL
