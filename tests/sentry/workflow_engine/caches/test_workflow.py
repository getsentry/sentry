from django.core.cache import cache

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.caches.workflow import (
    invalidate_processing_workflows,
    processing_workflow_cache_key,
)


class TestProcessingWorkflowCacheKey(TestCase):
    def setUp(self) -> None:
        self.environment = self.create_environment()
        self.detector = self.create_detector()

    def test_processing_workflow_cache_key(self) -> None:
        key = processing_workflow_cache_key(self.detector.id, self.environment.id)
        assert key == f"workflows_by_detector_env:{self.detector.id}:{self.environment.id}"

    def test_processing_workflow_cache_key__no_env(self) -> None:
        key = processing_workflow_cache_key(self.detector.id)
        assert key == f"workflows_by_detector_env:{self.detector.id}:*"

    def test_processing_workflow_cache_key__no_detector_or_env(self) -> None:
        key = processing_workflow_cache_key()
        assert key == f"workflows_by_detector_env:*:*"


class TestProcessingWorkflowCacheInvaliadation(TestCase):
    def setUp(self) -> None:
        self.environment = self.create_environment()
        self.detector = self.create_detector()
        self.key = processing_workflow_cache_key(self.detector.id, self.environment.id)
        self.key_no_env = processing_workflow_cache_key(self.detector.id)

        # warm the cache for the invalidation tests
        self.cache_value = "test"
        cache.set(self.key, self.cache_value)
        cache.set(self.key_no_env, self.cache_value)

        assert cache.get(self.key) == self.cache_value
        assert cache.get(self.key_no_env) == self.cache_value

    def test_cache_invalidate__by_detector_and_env(self):
        invalidate_processing_workflows(self.detector.id, self.environment.id)

        # Removes all items for the detector + env
        assert cache.get(self.key) is None
        assert cache.get(self.key_no_env) == self.cache_value

    def test_cache_invalidate__by_detector_no_env(self):
        env = self.create_environment()
        key = processing_workflow_cache_key(self.detector.id, env.id)
        cache.set(key, "another_test")

        invalidate_processing_workflows(self.detector.id)

        # Removes all items for detector.id
        assert cache.get(self.key) is None
        assert cache.get(key) is None
        assert cache.get(self.key_no_env) is None

    def test_cache_invalidate__entire_cache(self):
        detector = self.create_detector()
        env = self.create_environment()
        key = processing_workflow_cache_key(detector.id, env.id)
        cache.set(key, "new detector and env")

        invalidate_processing_workflows()

        assert cache.get(self.key) is None
        assert cache.get(self.key_no_env) is None
        assert cache.get(key) is None


class TestGetProcessingWorkflows(TestCase):
    def setUp(self) -> None:
        pass
