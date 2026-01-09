import pytest
from django.core.cache import cache
from sentry_protos.taskbroker.v1.taskbroker_pb2 import TaskActivation

from sentry.taskworker.app import TaskworkerApp
from sentry.taskworker.registry import TaskRegistry


@pytest.fixture
def clear_cache():
    cache.clear()


def test_taskregistry_param_and_property():
    registry = TaskRegistry(application="sentry")
    app = TaskworkerApp(taskregistry=registry)
    assert app.taskregistry == registry


def test_default_application_name():
    app = TaskworkerApp()
    ns = app.taskregistry.create_namespace(name="testing")
    assert ns.application == "default"
    assert ns.name == "testing"


def test_set_config():
    app = TaskworkerApp()
    app.set_config({"rpc_secret": "testing", "ignored": "key"})
    assert app.config["rpc_secret"] == "testing"
    assert "ignored" not in app.config


def test_should_attempt_at_most_once(clear_cache):
    activation = TaskActivation(
        id="111",
        taskname="examples.simple_task",
        namespace="examples",
        parameters='{"args": [], "kwargs": {}}',
        processing_deadline_duration=2,
    )
    app = TaskworkerApp()
    app.at_most_once_store(cache)
    assert app.should_attempt_at_most_once(activation)
    assert not app.should_attempt_at_most_once(activation)
