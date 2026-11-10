import contextlib
import signal
from unittest import mock

import orjson
import pytest
from django.db import ProgrammingError, connections, transaction
from django.db.transaction import TransactionManagementError
from django.test.utils import override_settings
from taskbroker_client.metrics import NoOpMetricsBackend
from taskbroker_client.registry import TaskRegistry
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.conf.types.kafka_definition import Topic
from sentry.models.groupmeta import GroupMeta
from sentry.models.options.option import Option
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.options.project_option import ProjectOption
from sentry.silo.base import SiloMode
from sentry.taskworker.adapters import (
    DatabaseConnectionResetHook,
    LocalCacheClearHook,
    SentryRouter,
    ViewerContextHook,
    make_producer,
    reset_database_connections,
)
from sentry.taskworker.runtime import app
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.user_option import UserOption
from sentry.utils.cache import cache
from sentry.viewer_context import (
    Actor,
    ActorType,
    ViewerContext,
    get_viewer_context,
    viewer_context_scope,
)


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
        ctx = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=7), organization_id=42)
        with viewer_context_scope(ctx):
            hook.on_dispatch(headers)

        payload = orjson.loads(headers["sentry-viewer-context"])
        assert payload["organization_id"] == 42
        assert payload["actor"]["id"] == 7
        assert payload["actor"]["type"] == "user"

    def test_on_dispatch_without_context(self) -> None:
        hook = ViewerContextHook()
        headers: dict[str, str] = {}
        hook.on_dispatch(headers)

        assert "sentry-viewer-context" not in headers

    def test_on_dispatch_partial_context(self) -> None:
        hook = ViewerContextHook()
        headers: dict[str, str] = {}
        ctx = ViewerContext(actor=Actor(type=ActorType.SYSTEM), organization_id=42)
        with viewer_context_scope(ctx):
            hook.on_dispatch(headers)

        payload = orjson.loads(headers["sentry-viewer-context"])
        assert payload["organization_id"] == 42
        assert "user_id" not in payload
        assert payload["actor"]["type"] == "system"

    def test_on_execute_restores_context(self) -> None:
        hook = ViewerContextHook()
        headers = {
            "sentry-viewer-context": orjson.dumps(
                {"version": 2, "organization_id": 42, "actor": {"type": "user", "id": 7}}
            ).decode(),
        }
        with hook.on_execute(headers):
            ctx = get_viewer_context()
            assert isinstance(ctx, ViewerContext)
            assert ctx.organization_id == 42
            assert ctx.actor.id == (ActorType.USER, 7)
            assert ctx.actor.type == ActorType.USER

        assert get_viewer_context() is None

    def test_on_execute_no_headers(self) -> None:
        hook = ViewerContextHook()
        cm = hook.on_execute({})
        assert isinstance(cm, contextlib.nullcontext)

    def test_on_execute_partial_headers(self) -> None:
        hook = ViewerContextHook()
        headers = {
            "sentry-viewer-context": orjson.dumps(
                {"version": 2, "organization_id": 99, "actor": {"type": "integration"}}
            ).decode(),
        }
        with hook.on_execute(headers):
            ctx = get_viewer_context()
            assert isinstance(ctx, ViewerContext)
            assert ctx.organization_id == 99
            assert ctx.actor.id == (ActorType.INTEGRATION, None)
            assert ctx.actor.type == ActorType.INTEGRATION

    def test_roundtrip(self) -> None:
        """Dispatch then execute produces the same ViewerContext."""
        hook = ViewerContextHook()
        headers: dict[str, str] = {}

        original = ViewerContext(
            actor=Actor(type=ActorType.USER, actor_id=456), organization_id=123
        )
        with viewer_context_scope(original):
            hook.on_dispatch(headers)

        with hook.on_execute(headers):
            restored = get_viewer_context()
            assert isinstance(restored, ViewerContext)
            assert restored.organization_id == original.organization_id
            assert restored.actor.actor_id == original.actor.actor_id
            assert restored.actor.type == original.actor.type

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

        # All OptionManagers share one process-local dict, so this one check
        # covers the organization, project and user options read above.
        assert not OrganizationOption.objects._option_cache

    def test_clears_the_caches_when_a_task_fails(self) -> None:
        hook = LocalCacheClearHook()
        with pytest.raises(ValueError):
            with hook.on_execute({}):
                OrganizationOption.objects.get_all_values(self.organization)
                raise ValueError("task failed")

        assert not OrganizationOption.objects._option_cache

    def test_clears_the_group_meta_cache(self) -> None:
        hook = LocalCacheClearHook()
        with mock.patch.object(GroupMeta.objects, "clear_local_cache") as group_meta:
            with hook.on_execute({}):
                pass

        group_meta.assert_called_once_with()

    def test_a_failure_to_clear_does_not_fail_the_task(self) -> None:
        hook = LocalCacheClearHook()
        with mock.patch.object(
            OrganizationOption.objects, "clear_local_cache", side_effect=RuntimeError("boom")
        ):
            with hook.on_execute({}):
                pass

    def test_the_sentry_task_app_uses_the_hook(self) -> None:
        assert any(isinstance(hook, LocalCacheClearHook) for hook in app.context_hooks)


# TestCase wraps each test in an atomic block, which the hook would close.
class TestDatabaseConnectionResetHook(TransactionTestCase):
    def _interrupt_commit(self) -> None:
        """Leave the default connection as a deadline inside Atomic.__exit__ does."""
        conn = connections["default"]
        with mock.patch.object(conn, "_commit", side_effect=ProcessingDeadlineExceeded()):
            with transaction.atomic(using="default"):
                Option.objects.create(key="taskworker.test", value="1")

    def test_keeps_connections_open_when_the_task_succeeds(self) -> None:
        hook = DatabaseConnectionResetHook()
        conn = connections["default"]
        conn.ensure_connection()
        raw = conn.connection

        with hook.on_execute({}):
            Option.objects.filter(key="taskworker.test").exists()

        assert conn.connection is raw

    def test_closes_connections_and_reraises_when_the_task_fails(self) -> None:
        hook = DatabaseConnectionResetHook()
        conn = connections["default"]

        with pytest.raises(ValueError):
            with hook.on_execute({}):
                Option.objects.filter(key="taskworker.test").exists()
                raise ValueError("task failed")

        assert conn.connection is None

    def test_closes_connections_on_a_processing_deadline(self) -> None:
        hook = DatabaseConnectionResetHook()
        conn = connections["default"]

        with pytest.raises(ProcessingDeadlineExceeded):
            with hook.on_execute({}):
                Option.objects.filter(key="taskworker.test").exists()
                raise ProcessingDeadlineExceeded()

        assert conn.connection is None

    def test_a_deadline_during_commit_breaks_the_connection_for_later_tasks(self) -> None:
        conn = connections["default"]
        # The commit is cut short with the transaction still open, so the
        # cleanup's set_autocommit(True) fails and replaces the deadline.
        with pytest.raises(ProgrammingError, match="set_session cannot be used"):
            self._interrupt_commit()

        assert not conn.get_autocommit()
        with pytest.raises(TransactionManagementError, match="manual transaction management"):
            transaction.on_commit(lambda: None, using="default")
        reset_database_connections()

    def test_the_next_task_works_after_a_deadline_broke_the_connection(self) -> None:
        hook = DatabaseConnectionResetHook()
        conn = connections["default"]

        with pytest.raises(ProgrammingError, match="set_session cannot be used"):
            with hook.on_execute({}):
                self._interrupt_commit()

        callback = mock.Mock()
        with hook.on_execute({}):
            transaction.on_commit(callback, using="default")
            with transaction.atomic(using="default"):
                Option.objects.create(key="taskworker.test.next", value="1")

        callback.assert_called_once_with()
        assert conn.get_autocommit()
        assert Option.objects.filter(key="taskworker.test.next").exists()
        # The write from the interrupted task was never committed.
        assert not Option.objects.filter(key="taskworker.test").exists()

    def test_closes_a_connection_left_inside_an_atomic_block(self) -> None:
        hook = DatabaseConnectionResetHook()
        conn = connections["default"]

        with pytest.raises(ValueError):
            with hook.on_execute({}):
                transaction.atomic(using="default").__enter__()
                Option.objects.create(key="taskworker.test", value="1")
                raise ValueError("task failed")

        assert conn.connection is None
        assert not conn.in_atomic_block
        assert not Option.objects.filter(key="taskworker.test").exists()

    def test_blocks_the_deadline_alarm_only_during_the_reset(self) -> None:
        hook = DatabaseConnectionResetHook()
        conn = connections["default"]
        conn.ensure_connection()
        blocked_during_close: list[bool] = []
        real_close = conn.close

        def close() -> None:
            mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
            blocked_during_close.append(signal.SIGALRM in mask)
            real_close()

        with mock.patch.object(conn, "close", side_effect=close):
            with pytest.raises(ValueError):
                with hook.on_execute({}):
                    raise ValueError("task failed")

        assert blocked_during_close == [True]
        assert signal.SIGALRM not in signal.pthread_sigmask(signal.SIG_BLOCK, set())

    def test_the_sentry_task_app_resets_connections_after_the_other_hooks(self) -> None:
        # ExitStack exits hooks in reverse, so the first hook's cleanup runs last.
        assert isinstance(app.context_hooks[0], DatabaseConnectionResetHook)
