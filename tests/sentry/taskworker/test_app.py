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
    app = TaskworkerApp(name="sentry", taskregistry=registry)
    assert app.taskregistry == registry


def test_namespace_inherit_application_name():
    app = TaskworkerApp(name="sentry")
    ns = app.taskregistry.create_namespace(name="testing")
    assert ns.application == "sentry"
    assert ns.name == "testing"


def test_set_config():
    app = TaskworkerApp(name="sentry")
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
    app = TaskworkerApp(name="sentry")
    app.at_most_once_store(cache)
    assert app.should_attempt_at_most_once(activation)
    assert not app.should_attempt_at_most_once(activation)
