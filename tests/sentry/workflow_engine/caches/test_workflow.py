from sentry.models.environment import Environment
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.caches.workflow import (
    _WorkflowCacheAccess,
    invalidate_processing_workflows,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.workflow import Workflow


class TestProcessingWorkflowCacheAccess(TestCase):
    def setUp(self) -> None:
        self.environment = self.create_environment()
        self.detector = self.create_detector()

    def test_processing_workflow_cache_key(self) -> None:
        key = _WorkflowCacheAccess(self.detector.id, self.environment.id).key()
        assert key == f"workflows_by_detector_env:{self.detector.id}:{self.environment.id}"

    def test_processing_workflow_cache_key__no_env(self) -> None:
        key = _WorkflowCacheAccess(self.detector.id, None).key()
        assert key == f"workflows_by_detector_env:{self.detector.id}:None"


class TestProcessingWorkflowCacheInvaliadation(TestCase):
    def setUp(self) -> None:
        self.environment = self.create_environment()
        self.detector = self.create_detector()

        # Create workflow and relationship so DB query can find them
        self.workflow = self.create_workflow(environment=self.environment)
        self.detector_workflow = self.create_detector_workflow(
            detector=self.detector, workflow=self.workflow
        )

        # Also create a workflow with no environment
        self.workflow_no_env = self.create_workflow()
        self.detector_workflow_no_env = self.create_detector_workflow(
            detector=self.detector, workflow=self.workflow_no_env
        )

        self.cache = _WorkflowCacheAccess(self.detector.id, self.environment.id)
        self.cache_no_env = _WorkflowCacheAccess(self.detector.id, None)

        # warm the cache for the invalidation tests
        self.cache_value = {self.workflow}
        self.cache.set(self.cache_value, 60)
        self.cache_no_env.set(self.cache_value, 60)

        assert self.cache.get() == self.cache_value
        assert self.cache_no_env.get() == self.cache_value

    def _env_and_workflow(self, detector: Detector | None = None) -> tuple[Environment, Workflow]:
        if detector is None:
            detector = self.detector

        env = self.create_environment()
        workflow = self.create_workflow(environment=env)
        self.create_detector_workflow(workflow=workflow, detector=detector)

        return env, workflow

    def test_cache_invalidate__by_detector_and_env(self):
        invalidate_processing_workflows(self.detector.id, self.environment.id)

        # Removes all items for the detector + env
        assert self.cache.get() is None

        # Other value is still set
        assert self.cache_no_env.get() == self.cache_value

    def test_cache_invalidate__by_detector(self):
        env, workflow = self._env_and_workflow()

        workflow_cache = _WorkflowCacheAccess(self.detector.id, env.id)
        workflow_cache.set({workflow}, 60)

        invalidate_processing_workflows(self.detector.id)

        assert self.cache.get() is None
        assert self.cache_no_env.get() is None
        assert workflow_cache.get() is None


class TestGetProcessingWorkflows(TestCase):
    def setUp(self) -> None:
        pass
