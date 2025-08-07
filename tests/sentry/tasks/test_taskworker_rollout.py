from unittest import mock

from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.registry import TaskRegistry
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class TestTaskworkerRollout(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.registry = TaskRegistry()
        self.namespace = self.registry.create_namespace(name="test_namespace")
        self.config = TaskworkerConfig(
            namespace=self.namespace,
            retry=None,
            expires=None,
            processing_deadline_duration=None,
            at_most_once=False,
            wait_for_delivery=False,
        )

    @mock.patch("sentry.taskworker.registry.TaskNamespace.send_task")
    @override_options({"taskworker.enabled": True})
    def test_with_taskworker_enabled_option(self, mock_send_task: mock.MagicMock) -> None:
        @instrumented_task(
            name="test.test_with_taskworker_rollout",
            taskworker_config=self.config,
        )
        def test_task() -> str:
            return "done"

        assert test_task.name == "test.test_with_taskworker_rollout"
        task = self.namespace.get("test.test_with_taskworker_rollout")
        assert task is not None
        assert task.name == "test.test_with_taskworker_rollout"
        test_task.delay()
        test_task.apply_async()
        assert mock_send_task.call_count == 2

    @mock.patch("sentry.celery.Task.apply_async")
    @override_options({"taskworker.enabled": False})
    def test_without_taskworker_rollout(self, mock_celery_apply_async: mock.MagicMock) -> None:
        @instrumented_task(
            name="test.test_without_taskworker_rollout",
            taskworker_config=self.config,
        )
        def test_task(msg):
            return f"hello {msg}"

        assert test_task.name == "test.test_without_taskworker_rollout"
        assert self.namespace.contains("test.test_without_taskworker_rollout") is True
        test_task.delay()
        test_task.apply_async()
        assert mock_celery_apply_async.call_count == 2
