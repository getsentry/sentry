import contextlib
from unittest import mock

import orjson
import pytest
from django.test.utils import override_settings
from taskbroker_client.metrics import NoOpMetricsBackend
from taskbroker_client.registry import TaskRegistry

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.models.groupmeta import GroupMeta
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.options.project_option import ProjectOption
from sentry.silo.base import SiloMode
from sentry.taskworker.adapters import (
    LocalCacheClearHook,
    SentryRouter,
    ViewerContextHook,
    make_producer,
)
from sentry.taskworker.runtime import app
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.user_option import UserOption
from sentry.utils.cache import cache
from sentry.viewer_context import ActorType, ViewerContext, get_viewer_context, viewer_context_scope


@pytest.mark.django_db
def test_registry_create_namespace_route_setting() -> None:
    with override_settings(
        TASKWORKER_ROUTES='{"profiling":"profiles", "private":"private-taskworker-topic"}'
    ):
        registry = TaskRegistry(
            application="sentry",
            producer_factory=make_producer,
            router=SentryRouter(),
            metrics=NoOpMetricsBackend(),
        )

        # namespaces without routes resolve to the default topic.
        tests = registry.create_namespace(name="tests")
        assert tests.topic == Topic.TASKWORKER.value

        profiling = registry.create_namespace(name="profiling")
        assert profiling.topic == "profiles"

        private = registry.create_namespace(name="private")
        assert private.topic == "private-taskworker-topic"


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


@pytest.mark.django_db
def test_default_router_topic_override() -> None:
    with override_settings(
        SILO_MODE=SiloMode.CELL,
        TASKWORKER_DEFAULT_TOPIC="taskworker-push",
    ):
        router = SentryRouter()
        topic = router.route_namespace("test.tasks.test_router.unrouted")
        assert topic == "taskworker-push"


@pytest.mark.django_db(databases=["default", "control"])
def test_default_router_topic_override_ignored_in_control_silo() -> None:
    # The region default-topic override must never redirect control-silo tasks.
    with override_settings(
        SILO_MODE=SiloMode.CONTROL,
        TASKWORKER_DEFAULT_TOPIC="taskworker-push",
    ):
        router = SentryRouter()
        topic = router.route_namespace("test.tasks.test_router.control")
        assert topic == Topic.TASKWORKER_CONTROL.value


class TestViewerContextHook:
    def test_on_dispatch_with_context(self) -> None:
        hook = ViewerContextHook()
        headers: dict[str, str] = {}
        ctx = ViewerContext(organization_id=42, user_id=7, actor_type=ActorType.USER)
        with viewer_context_scope(ctx):
            hook.on_dispatch(headers)

        payload = orjson.loads(headers["sentry-viewer-context"])
        assert payload["organization_id"] == 42
        assert payload["user_id"] == 7
        assert payload["actor_type"] == "user"

    def test_on_dispatch_without_context(self) -> None:
        hook = ViewerContextHook()
        headers: dict[str, str] = {}
        hook.on_dispatch(headers)

        assert "sentry-viewer-context" not in headers

    def test_on_dispatch_partial_context(self) -> None:
        hook = ViewerContextHook()
        headers: dict[str, str] = {}
        ctx = ViewerContext(organization_id=42, actor_type=ActorType.SYSTEM)
        with viewer_context_scope(ctx):
            hook.on_dispatch(headers)

        payload = orjson.loads(headers["sentry-viewer-context"])
        assert payload["organization_id"] == 42
        assert "user_id" not in payload
        assert payload["actor_type"] == "system"

    def test_on_execute_restores_context(self) -> None:
        hook = ViewerContextHook()
        headers = {
            "sentry-viewer-context": orjson.dumps(
                {"organization_id": 42, "user_id": 7, "actor_type": "user"}
            ).decode(),
        }
        with hook.on_execute(headers):
            ctx = get_viewer_context()
            assert ctx is not None
            assert ctx.organization_id == 42
            assert ctx.user_id == 7
            assert ctx.actor_type == ActorType.USER

        assert get_viewer_context() is None

    def test_on_execute_no_headers(self) -> None:
        hook = ViewerContextHook()
        cm = hook.on_execute({})
        assert isinstance(cm, contextlib.nullcontext)

    def test_on_execute_partial_headers(self) -> None:
        hook = ViewerContextHook()
        headers = {
            "sentry-viewer-context": orjson.dumps(
                {"organization_id": 99, "actor_type": "integration"}
            ).decode(),
        }
        with hook.on_execute(headers):
            ctx = get_viewer_context()
            assert ctx is not None
            assert ctx.organization_id == 99
            assert ctx.user_id is None
            assert ctx.actor_type == ActorType.INTEGRATION

    def test_roundtrip(self) -> None:
        """Dispatch then execute produces the same ViewerContext."""
        hook = ViewerContextHook()
        headers: dict[str, str] = {}

        original = ViewerContext(organization_id=123, user_id=456, actor_type=ActorType.USER)
        with viewer_context_scope(original):
            hook.on_dispatch(headers)

        with hook.on_execute(headers):
            restored = get_viewer_context()
            assert restored is not None
            assert restored.organization_id == original.organization_id
            assert restored.user_id == original.user_id
            assert restored.actor_type == original.actor_type

    def test_on_execute_malformed_json(self) -> None:
        hook = ViewerContextHook()
        headers = {"sentry-viewer-context": "not-valid-json{"}
        cm = hook.on_execute(headers)
        assert isinstance(cm, contextlib.nullcontext)

    def test_on_execute_non_dict_json(self) -> None:
        hook = ViewerContextHook()
        headers = {"sentry-viewer-context": "[1, 2, 3]"}
        cm = hook.on_execute(headers)
        assert isinstance(cm, contextlib.nullcontext)


class TestLocalCacheClearHook(TestCase):
    def test_a_later_task_reads_options_saved_after_an_earlier_task(self) -> None:
        hook = LocalCacheClearHook()
        OrganizationOption.objects.set_value(self.organization, "foo", "bar")
        ProjectOption.objects.set_value(self.project, "foo", "bar")

        # The first task reads the options; the worker caches them locally.
        with hook.on_execute({}):
            assert OrganizationOption.objects.get_value(self.organization, "foo") == "bar"
            assert ProjectOption.objects.get_value(self.project, "foo") == "bar"

        # Another process saves new values: the database and the shared cache
        # change, and nothing tells this worker.
        OrganizationOption.objects.filter(organization=self.organization, key="foo").update(
            value="baz"
        )
        cache.set(OrganizationOption.objects._make_key(self.organization.id), {"foo": "baz"})
        ProjectOption.objects.filter(project=self.project, key="foo").update(value="baz")
        cache.set(ProjectOption.objects._make_key(self.project.id), {"foo": "baz"})

        # The next task in the same worker sees them.
        with hook.on_execute({}):
            assert OrganizationOption.objects.get_value(self.organization, "foo") == "baz"
            assert ProjectOption.objects.get_value(self.project, "foo") == "baz"

    def test_clears_the_option_caches_when_a_task_finishes(self) -> None:
        hook = LocalCacheClearHook()
        with hook.on_execute({}):
            OrganizationOption.objects.get_all_values(self.organization)
            ProjectOption.objects.get_all_values(self.project)
            with assume_test_silo_mode(SiloMode.CONTROL):
                UserOption.objects.get_all_values(self.user)
            assert OrganizationOption.objects._option_cache

        assert not OrganizationOption.objects._option_cache
        assert not ProjectOption.objects._option_cache
        assert not UserOption.objects._option_cache

    def test_clears_the_caches_when_a_task_fails(self) -> None:
        hook = LocalCacheClearHook()
        with pytest.raises(ValueError):
            with hook.on_execute({}):
                OrganizationOption.objects.get_all_values(self.organization)
                raise ValueError("task failed")

        assert not OrganizationOption.objects._option_cache

    def test_clears_the_other_caches_task_postrun_cleared(self) -> None:
        hook = LocalCacheClearHook()
        with (
            mock.patch.object(GroupMeta.objects, "clear_local_cache") as group_meta,
            mock.patch.object(options.default_store, "maybe_clean_local_cache") as store,
        ):
            with hook.on_execute({}):
                pass

        group_meta.assert_called_once_with()
        store.assert_called_once_with()

    def test_a_failure_to_clear_does_not_fail_the_task(self) -> None:
        hook = LocalCacheClearHook()
        with mock.patch.object(
            OrganizationOption.objects, "clear_local_cache", side_effect=RuntimeError("boom")
        ):
            with hook.on_execute({}):
                pass

    def test_the_sentry_task_app_uses_the_hook(self) -> None:
        assert any(isinstance(hook, LocalCacheClearHook) for hook in app.context_hooks)
