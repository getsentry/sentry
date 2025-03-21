from unittest import mock

from sentry import options
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.registry import TaskRegistry
from sentry.testutils.cases import TestCase

registry = TaskRegistry()


class TestTaskworkerRollout(TestCase):
    def setUp(self):
        super().setUp()
        self.namespace = registry.create_namespace(name="test_namespace")
        self.config = TaskworkerConfig(
            namespace=self.namespace,
            retry=None,
            expires=None,
            processing_deadline_duration=None,
            at_most_once=False,
            wait_for_delivery=False,
        )

    @mock.patch("random.random")
    def test_with_taskworker_rollout(self, mock_random):
        mock_random.return_value = 0.3

        options.set(f"taskworker.{self.namespace.name}.rollout", 0.5)

        @instrumented_task(
            name="test.test_with_taskworker_rollout",
            taskworker_config=self.config,
        )
        def test_task():
            return "done"

        assert test_task.name == "test.test_with_taskworker_rollout"
        task = self.namespace.get_task("test.test_with_taskworker_rollout")
        assert task is not None
        assert task.name == "test.test_with_taskworker_rollout"

    @mock.patch("random.random")
    def test_without_taskworker_rollout(self, mock_random):
        mock_random.return_value = 0.7

        options.set(f"taskworker.{self.namespace.name}.rollout", 0.5)

        @instrumented_task(
            name="test.test_without_taskworker_rollout",
            taskworker_config=self.config,
        )
        def test_task():
            return "done"

        assert test_task.name == "test.test_without_taskworker_rollout"
        assert self.namespace.contains("test.test_without_taskworker_rollout") is False

    def test_taskworker_no_rollout_configured(self):
        @instrumented_task(
            name="test.test_taskworker_no_rollout_configured",
            taskworker_config=self.config,
        )
        def test_task():
            return "done"

        assert test_task.name == "test.task"
        assert self.namespace.contains("test.test_without_taskworker_rollout") is False
