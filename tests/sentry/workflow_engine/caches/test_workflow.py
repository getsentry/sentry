from django.core.cache import cache

from sentry.models.environment import Environment
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.caches.workflow import (
    invalidate_processing_workflows,
    processing_workflow_cache_key,
)
from sentry.workflow_engine.models import Detector


class TestProcessingWorkflowCacheKey(TestCase):
    def setUp(self) -> None:
        self.environment = self.create_environment()
        self.detector = self.create_detector()

    def test_processing_workflow_cache_key(self) -> None:
        key = processing_workflow_cache_key(self.detector.id, self.environment.id)
        assert key == f"workflows_by_detector_env:{self.detector.id}:{self.environment.id}"

    def test_processing_workflow_cache_key__no_env(self) -> None:
        key = processing_workflow_cache_key(self.detector.id)
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

        self.key = processing_workflow_cache_key(self.detector.id, self.environment.id)
        self.key_no_env = processing_workflow_cache_key(self.detector.id, None)

        # warm the cache for the invalidation tests
        self.cache_value = "test"
        cache.set(self.key, self.cache_value)
        cache.set(self.key_no_env, self.cache_value)

        assert cache.get(self.key) == self.cache_value
        assert cache.get(self.key_no_env) == self.cache_value

    def _env_and_workflow(self, detector: Detector | None = None) -> Environment:
        if detector is None:
            detector = self.detector

        env = self.create_environment()
        workflow = self.create_workflow(environment=env)
        self.create_detector_workflow(workflow=workflow, detector=detector)

        return env

    def test_cache_invalidate__by_detector_and_env(self):
        invalidate_processing_workflows(self.detector.id, self.environment.id)

        # Removes all items for the detector + env
        assert cache.get(self.key) is None
        assert cache.get(self.key_no_env) == self.cache_value

    def test_cache_invalidate__by_detector_no_env(self):
        env = self._env_and_workflow()

        key = processing_workflow_cache_key(self.detector.id, env.id)
        cache.set(key, "another_test")

        invalidate_processing_workflows(self.detector.id)

        # Removes all items for detector.id
        assert cache.get(self.key) is None
        assert cache.get(key) is None
        assert cache.get(self.key_no_env) is None


class TestGetProcessingWorkflows(TestCase):
    def setUp(self) -> None:
        pass
