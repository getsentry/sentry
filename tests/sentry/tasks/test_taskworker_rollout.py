from unittest import mock

from sentry import options
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.registry import TaskRegistry
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

registry = TaskRegistry()


class TestTaskworkerRollout(TestCase):
    def setUp(self):
        super().setUp()
        if not registry.contains("test_namespace"):
            self.namespace = registry.create_namespace(name="test_namespace")
        else:
            self.namespace = registry.get("test_namespace")
        self.config = TaskworkerConfig(
            namespace=self.namespace,
            retry=None,
            expires=None,
            processing_deadline_duration=None,
            at_most_once=False,
            wait_for_delivery=False,
        )
        options.register("taskworker.test_namespace.rollout", default={})

    def tearDown(self):
        super().tearDown()
        options.unregister("taskworker.test_namespace.rollout")

    @mock.patch("sentry.tasks.base.random.random")
    @mock.patch("sentry.taskworker.registry.TaskNamespace.send_task")
    @override_options(
        {"taskworker.test_namespace.rollout": {"test.test_with_taskworker_rollout": 0.5}}
    )
    def test_with_taskworker_rollout(self, mock_send_task, mock_random):
        mock_random.return_value = 0.3

        @instrumented_task(
            name="test.test_with_taskworker_rollout",
            taskworker_config=self.config,
        )
        def test_task():
            return "done"

        assert test_task.name == "test.test_with_taskworker_rollout"
        task = self.namespace.get("test.test_with_taskworker_rollout")
        assert task is not None
        assert task.name == "test.test_with_taskworker_rollout"
        test_task.delay()
        test_task.apply_async()
        assert mock_send_task.call_count == 2

    @mock.patch("sentry.tasks.base.random.random")
    @mock.patch("sentry.taskworker.registry.TaskNamespace.send_task")
    @override_options(
        {"taskworker.test_namespace.rollout": {"test.test_with_taskworker_rollout": 0.5}}
    )
    def test_with_taskworker_rollout_with_args(self, mock_send_task, mock_random):
        mock_random.return_value = 0.3

        @instrumented_task(
            name="test.test_with_taskworker_rollout",
            taskworker_config=self.config,
        )
        def test_task(msg):
            return f"hello {msg}"

        assert test_task.name == "test.test_with_taskworker_rollout"
        task = self.namespace.get("test.test_with_taskworker_rollout")
        assert task is not None
        assert task.name == "test.test_with_taskworker_rollout"
        test_task.delay("world")
        test_task.apply_async(["world"])
        assert mock_send_task.call_count == 2

    @mock.patch("sentry.tasks.base.random.random")
    @mock.patch("sentry.taskworker.registry.TaskNamespace.send_task")
    @mock.patch("sentry.celery.Task.apply_async")
    @override_options({"taskworker.test_namespace.rollout": {"*": 0.5, "test.low_rate": 0.1}})
    def test_with_taskworker_rollout_with_glob_option(
        self, mock_celery_apply, mock_send_task, mock_random
    ):
        mock_random.return_value = 0.3

        @instrumented_task(
            name="test.test_with_taskworker_rollout",
            taskworker_config=self.config,
        )
        def test_task(msg):
            return f"hello {msg}"

        @instrumented_task(
            name="test.low_rate",
            taskworker_config=self.config,
        )
        def test_low_rate(msg):
            return f"hello {msg}"

        test_task.delay("world")
        test_task.apply_async(["world"])
        assert mock_send_task.call_count == 2
        assert mock_celery_apply.call_count == 0

        test_low_rate.delay("world")
        test_low_rate.apply_async(["world"])
        assert mock_send_task.call_count == 2
        assert mock_celery_apply.call_count == 2

    @mock.patch("sentry.tasks.base.random.random")
    @mock.patch("sentry.celery.Task.apply_async")
    @override_options(
        {"taskworker.test_namespace.rollout": {"test.test_without_taskworker_rollout": 0.3}}
    )
    def test_without_taskworker_rollout(self, mock_celery_apply_async, mock_random):
        mock_random.return_value = 0.5

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

    @mock.patch("sentry.tasks.base.random.random")
    @mock.patch("sentry.celery.Task.apply_async")
    @override_options(
        {"taskworker.test_namespace.rollout": {"test.test_without_taskworker_rollout": 0.3}}
    )
    def test_without_taskworker_rollout_with_args(self, mock_celery_apply_async, mock_random):
        mock_random.return_value = 0.5

        @instrumented_task(
            name="test.test_without_taskworker_rollout",
            taskworker_config=self.config,
        )
        def test_task(a, b):
            return a + b

        assert test_task.name == "test.test_without_taskworker_rollout"
        assert self.namespace.contains("test.test_without_taskworker_rollout") is True
        test_task.delay(1, 2)
        test_task.apply_async(1, 2)
        assert mock_celery_apply_async.call_count == 2

    @mock.patch("sentry.celery.Task.apply_async")
    def test_taskworker_no_rollout_configured(self, mock_celery_apply_async):
        @instrumented_task(
            name="test.test_taskworker_no_rollout_configured",
            taskworker_config=self.config,
        )
        def test_task():
            return "done"

        assert test_task.name == "test.test_taskworker_no_rollout_configured"
        assert self.namespace.contains("test.test_without_taskworker_rollout") is False
        test_task.delay()
        test_task.apply_async()
        assert mock_celery_apply_async.call_count == 2

    @mock.patch("sentry.celery.Task.apply_async")
    def test_taskworker_no_rollout_configured_with_args(self, mock_celery_apply_async):
        @instrumented_task(
            name="test.test_taskworker_no_rollout_configured",
            taskworker_config=self.config,
        )
        def test_task(msg):
            return f"hello {msg}"

        assert test_task.name == "test.test_taskworker_no_rollout_configured"
        assert self.namespace.contains("test.test_without_taskworker_rollout") is False
        test_task.delay("world")
        test_task.apply_async("world")
        assert mock_celery_apply_async.call_count == 2
