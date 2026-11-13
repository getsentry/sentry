import contextlib
import signal
from collections.abc import Callable, Iterator
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


class TaskFailed(Exception):
    pass


# Use TransactionTestCase so we handle the atomic blocks ourselves
class TestDatabaseConnectionResetHook(TransactionTestCase):
    def test_keeps_the_connection_open_when_the_task_succeeds(self) -> None:
        connection = connections["default"]

        connection.ensure_connection()

        connection_before_the_task = connection.connection

        with self._task():
            Option.objects.filter(key="taskworker.test").exists()

        assert connection.connection is connection_before_the_task

    def test_closes_the_connection_when_the_task_fails(self) -> None:
        with self._task_that_raises(TaskFailed):
            Option.objects.filter(key="taskworker.test").exists()

        assert connections["default"].connection is None

    def test_closes_the_connection_when_the_task_hits_the_deadline(self) -> None:
        with self._task_that_raises(ProcessingDeadlineExceeded):
            Option.objects.filter(key="taskworker.test").exists()

        assert connections["default"].connection is None

    def test_does_not_reconnect_after_a_task_that_never_used_the_database(self) -> None:
        with self._task_that_raises(TaskFailed):
            Option.objects.filter(key="taskworker.test").exists()

        with self._task():
            pass

        assert connections["default"].connection is None

    def test_without_a_reset_on_commit_fails_after_a_deadline_during_commit(self) -> None:
        """
        This test triggers the bug that is fixed by the hook
        If this fails, then perhaps the hook is no longer needed
        """
        self.addCleanup(reset_database_connections)

        with pytest.raises(ProgrammingError, match="set_session cannot be used"):
            self._hit_the_deadline_during_commit()

        with pytest.raises(TransactionManagementError, match="manual transaction management"):
            transaction.on_commit(lambda: None, using="default")

    def test_on_commit_works_in_the_next_task_after_a_deadline_during_commit(self) -> None:
        with self._task_that_raises(ProgrammingError):
            self._hit_the_deadline_during_commit()

        commit_hook = mock.Mock()

        with self._task():
            transaction.on_commit(commit_hook, using="default")

        commit_hook.assert_called_once_with()

        assert not Option.objects.filter(key="taskworker.interrupted").exists()

    def test_on_commit_works_in_the_next_task_after_a_task_swallowed_a_deadline_during_commit(
        self,
    ) -> None:
        with self._task():
            with contextlib.suppress(ProgrammingError):
                self._hit_the_deadline_during_commit()

        commit_hook = mock.Mock()

        with self._task():
            transaction.on_commit(commit_hook, using="default")

        commit_hook.assert_called_once_with()

    def test_the_next_task_can_roll_back_after_a_task_left_an_atomic_block_open(self) -> None:
        with self._task_that_raises(TaskFailed):
            self._leave_an_atomic_block_open()

            Option.objects.create(key="taskworker.left_open", value="1")

        with self._task():
            assert self._a_transaction_can_roll_back()

        assert not Option.objects.filter(key="taskworker.left_open").exists()

    def test_the_next_task_can_roll_back_after_a_task_closed_the_connection_in_an_open_atomic_block(
        self,
    ) -> None:
        with self._task_that_raises(TaskFailed):
            self._leave_an_atomic_block_open()

            connections["default"].close()

        with self._task():
            assert self._a_transaction_can_roll_back()

    def test_drops_the_commit_hooks_a_deadline_kept_from_running(self) -> None:
        commit_hook = mock.Mock()

        with self._task_that_raises(ProcessingDeadlineExceeded):
            self._hit_the_deadline_before_the_commit_hooks_run(commit_hook)

        with self._task():
            Option.objects.filter(key="taskworker.test").exists()

        commit_hook.assert_not_called()

    def test_blocks_the_deadline_alarm_only_while_resetting(self) -> None:
        connection = connections["default"]

        connection.ensure_connection()

        alarm_blocked_on_each_close: list[bool] = []

        def record_whether_the_alarm_is_blocked() -> None:
            alarm_blocked_on_each_close.append(self._is_the_deadline_alarm_blocked())

        with mock.patch.object(
            connection, "close", side_effect=record_whether_the_alarm_is_blocked
        ):
            with self._task_that_raises(TaskFailed):
                pass

        assert set(alarm_blocked_on_each_close) == {True}

        assert not self._is_the_deadline_alarm_blocked()

    @contextlib.contextmanager
    def _task(self) -> Iterator[None]:
        with DatabaseConnectionResetHook().on_execute({}):
            yield

    @contextlib.contextmanager
    def _task_that_raises(self, error_type: type[BaseException]) -> Iterator[None]:
        with pytest.raises(error_type):
            with self._task():
                yield

                raise error_type()

    def _hit_the_deadline_during_commit(self) -> None:
        # Django's cleanup can't turn autocommit back on mid-transaction, so a ProgrammingError replaces the deadline
        with mock.patch.object(
            connections["default"], "_commit", side_effect=ProcessingDeadlineExceeded()
        ):
            with transaction.atomic(using="default"):
                Option.objects.create(key="taskworker.interrupted", value="1")

    def _hit_the_deadline_before_the_commit_hooks_run(
        self, commit_hook: Callable[[], None]
    ) -> None:
        with mock.patch.object(
            connections["default"],
            "run_and_clear_commit_hooks",
            side_effect=ProcessingDeadlineExceeded(),
        ):
            with transaction.atomic(using="default"):
                transaction.on_commit(commit_hook, using="default")

    def _leave_an_atomic_block_open(self) -> None:
        transaction.atomic(using="default").__enter__()

    def _a_transaction_can_roll_back(self) -> bool:
        with transaction.atomic(using="default"):
            Option.objects.create(key="taskworker.rolled_back", value="1")

            transaction.set_rollback(True, using="default")

        return not Option.objects.filter(key="taskworker.rolled_back").exists()

    def _is_the_deadline_alarm_blocked(self) -> bool:
        return signal.SIGALRM in signal.pthread_sigmask(signal.SIG_BLOCK, set())
