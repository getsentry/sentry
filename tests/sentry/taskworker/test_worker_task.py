import pytest
from django.conf import settings

from sentry.taskdemo import broken, say_hello
from sentry.testutils.cases import TestCase


class TaskWorkerTest(TestCase):
    def test_run_task_with_eager_restores_settings(self):
        with self.tasks():
            say_hello.delay("John")
        assert not settings.TASK_WORKER_ALWAYS_EAGER

    def test_run_task_with_excep(self):
        with pytest.raises(ValueError):
            with self.tasks():
                broken.delay("boom")
