from sentry.models.environment import Environment
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.caches.workflow import (
    _check_caches_for_detectors,
    _populate_detector_caches,
    _query_workflows_by_detector_ids,
    _WorkflowCacheAccess,
    _WorkflowsByDetector,
    get_workflows_by_detectors,
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

    def test_cache_invalidate__by_detector_and_env(self) -> None:
        invalidate_processing_workflows(self.detector.id, self.environment.id)

        # Removes all items for the detector + env
        assert self.cache.get() is None

        # Other value is still set
        assert self.cache_no_env.get() == self.cache_value

    def test_cache_invalidate__by_detector(self) -> None:
        env, workflow = self._env_and_workflow()

        workflow_cache = _WorkflowCacheAccess(self.detector.id, env.id)
        workflow_cache.set({workflow}, 60)

        invalidate_processing_workflows(self.detector.id)

        assert self.cache.get() is None
        assert self.cache_no_env.get() is None
        assert workflow_cache.get() is None


class TestGetWorkflowsByDetectors(TestCase):
    def setUp(self) -> None:
        self.environment = self.create_environment()
        self.detector1 = self.create_detector()
        self.detector2 = self.create_detector()

        # Create workflows for detector1
        self.workflow1 = self.create_workflow(environment=self.environment)
        self.create_detector_workflow(detector=self.detector1, workflow=self.workflow1)

        # Create workflow for detector2
        self.workflow2 = self.create_workflow(environment=self.environment)
        self.create_detector_workflow(detector=self.detector2, workflow=self.workflow2)

        # Create workflow shared by both detectors
        self.shared_workflow = self.create_workflow(environment=self.environment)
        self.create_detector_workflow(detector=self.detector1, workflow=self.shared_workflow)
        self.create_detector_workflow(detector=self.detector2, workflow=self.shared_workflow)

    def test_empty_detectors_returns_empty_set(self) -> None:
        result = get_workflows_by_detectors([], self.environment)
        assert result == set()

    def test_single_detector_returns_workflows(self) -> None:
        result = get_workflows_by_detectors([self.detector1], self.environment)
        assert result == {self.workflow1, self.shared_workflow}

    def test_multiple_detectors_unions_results(self) -> None:
        result = get_workflows_by_detectors([self.detector1, self.detector2], self.environment)
        assert result == {self.workflow1, self.workflow2, self.shared_workflow}

    def test_cache_populated_after_cold_lookup(self) -> None:
        # Cache should be cold initially
        env_id = self.environment.id
        cache1 = _WorkflowCacheAccess(self.detector1.id, env_id)
        cache2 = _WorkflowCacheAccess(self.detector2.id, env_id)

        assert cache1.get() is None
        assert cache2.get() is None

        # Call the function (cold cache)
        get_workflows_by_detectors([self.detector1, self.detector2], self.environment)

        # Now cache should be populated for each detector
        assert cache1.get() == {self.workflow1, self.shared_workflow}
        assert cache2.get() == {self.workflow2, self.shared_workflow}

    def test_hot_cache_no_db_query(self) -> None:
        env_id = self.environment.id
        cache1 = _WorkflowCacheAccess(self.detector1.id, env_id)
        cache2 = _WorkflowCacheAccess(self.detector2.id, env_id)

        # Pre-populate cache
        cache1.set({self.workflow1, self.shared_workflow}, 60)
        cache2.set({self.workflow2, self.shared_workflow}, 60)

        # Call the function - should return cached values
        result = get_workflows_by_detectors([self.detector1, self.detector2], self.environment)
        assert result == {self.workflow1, self.workflow2, self.shared_workflow}

    def test_partial_cache_hit(self) -> None:
        env_id = self.environment.id
        cache1 = _WorkflowCacheAccess(self.detector1.id, env_id)
        cache2 = _WorkflowCacheAccess(self.detector2.id, env_id)

        # Pre-populate only detector1's cache
        cache1.set({self.workflow1, self.shared_workflow}, 60)
        assert cache2.get() is None

        # Call the function - detector1 hits cache, detector2 misses
        result = get_workflows_by_detectors([self.detector1, self.detector2], self.environment)
        assert result == {self.workflow1, self.workflow2, self.shared_workflow}

        # detector2's cache should now be populated
        assert cache2.get() == {self.workflow2, self.shared_workflow}

    def test_no_environment_filter(self) -> None:
        # Create workflow with no environment
        workflow_no_env = self.create_workflow()
        self.create_detector_workflow(detector=self.detector1, workflow=workflow_no_env)

        result = get_workflows_by_detectors([self.detector1], None)
        assert result == {workflow_no_env}

    def test_environment_includes_none_environment_workflows(self) -> None:
        # Create workflow with no environment
        workflow_no_env = self.create_workflow()
        self.create_detector_workflow(detector=self.detector1, workflow=workflow_no_env)

        # When environment is specified, should include workflows with that env OR no env
        result = get_workflows_by_detectors([self.detector1], self.environment)
        assert workflow_no_env in result
        assert self.workflow1 in result

    def test_disabled_workflows_excluded(self) -> None:
        self.workflow1.enabled = False
        self.workflow1.save()

        result = get_workflows_by_detectors([self.detector1], self.environment)
        assert self.workflow1 not in result
        assert self.shared_workflow in result


class TestCheckCachesForDetectors(TestCase):
    def setUp(self) -> None:
        self.environment = self.create_environment()
        self.detector1 = self.create_detector()
        self.detector2 = self.create_detector()
        self.workflow1 = self.create_workflow(environment=self.environment)
        self.workflow2 = self.create_workflow(environment=self.environment)

    def test_all_cache_misses(self) -> None:
        env_id = self.environment.id

        result = _check_caches_for_detectors([self.detector1, self.detector2], env_id)

        assert result.cached_workflows == set()
        assert result.missed_detector_ids == [self.detector1.id, self.detector2.id]
        assert not result.all_hits

    def test_all_cache_hits(self) -> None:
        env_id = self.environment.id
        cache1 = _WorkflowCacheAccess(self.detector1.id, env_id)
        cache2 = _WorkflowCacheAccess(self.detector2.id, env_id)
        cache1.set({self.workflow1}, 60)
        cache2.set({self.workflow2}, 60)

        result = _check_caches_for_detectors([self.detector1, self.detector2], env_id)

        assert result.cached_workflows == {self.workflow1, self.workflow2}
        assert result.missed_detector_ids == []
        assert result.all_hits

    def test_partial_cache_hit(self) -> None:
        env_id = self.environment.id
        cache1 = _WorkflowCacheAccess(self.detector1.id, env_id)
        cache1.set({self.workflow1}, 60)

        result = _check_caches_for_detectors([self.detector1, self.detector2], env_id)

        assert result.cached_workflows == {self.workflow1}
        assert result.missed_detector_ids == [self.detector2.id]
        assert not result.all_hits

    def test_empty_detectors(self) -> None:
        result = _check_caches_for_detectors([], self.environment.id)

        assert result.cached_workflows == set()
        assert result.missed_detector_ids == []
        assert result.all_hits


class TestQueryWorkflowsByDetectorIds(TestCase):
    def setUp(self) -> None:
        self.environment = self.create_environment()
        self.detector1 = self.create_detector()
        self.detector2 = self.create_detector()

        self.workflow1 = self.create_workflow(environment=self.environment)
        self.create_detector_workflow(detector=self.detector1, workflow=self.workflow1)

        self.workflow2 = self.create_workflow(environment=self.environment)
        self.create_detector_workflow(detector=self.detector2, workflow=self.workflow2)

    def test_single_detector(self) -> None:
        result = _query_workflows_by_detector_ids([self.detector1.id], self.environment)

        assert result.mapping == {self.detector1.id: {self.workflow1}}

    def test_multiple_detectors(self) -> None:
        result = _query_workflows_by_detector_ids(
            [self.detector1.id, self.detector2.id], self.environment
        )

        assert result.mapping == {
            self.detector1.id: {self.workflow1},
            self.detector2.id: {self.workflow2},
        }

    def test_no_environment_filter(self) -> None:
        workflow_no_env = self.create_workflow()
        self.create_detector_workflow(detector=self.detector1, workflow=workflow_no_env)

        result = _query_workflows_by_detector_ids([self.detector1.id], None)

        assert result.mapping == {self.detector1.id: {workflow_no_env}}

    def test_environment_includes_none_environment_workflows(self) -> None:
        workflow_no_env = self.create_workflow()
        self.create_detector_workflow(detector=self.detector1, workflow=workflow_no_env)

        result = _query_workflows_by_detector_ids([self.detector1.id], self.environment)

        assert self.workflow1 in result.mapping.get(self.detector1.id, set())
        assert workflow_no_env in result.mapping.get(self.detector1.id, set())

    def test_disabled_workflows_excluded(self) -> None:
        self.workflow1.enabled = False
        self.workflow1.save()

        result = _query_workflows_by_detector_ids([self.detector1.id], self.environment)

        assert result.mapping == {self.detector1.id: set()}

    def test_empty_detector_ids(self) -> None:
        result = _query_workflows_by_detector_ids([], self.environment)

        assert result.mapping == {}

    def test_all_workflows_helper(self) -> None:
        result = _query_workflows_by_detector_ids(
            [self.detector1.id, self.detector2.id], self.environment
        )

        assert result.all_workflows == {self.workflow1, self.workflow2}


class TestPopulateDetectorCaches(TestCase):
    def setUp(self) -> None:
        self.environment = self.create_environment()
        self.detector1 = self.create_detector()
        self.detector2 = self.create_detector()
        self.workflow1 = self.create_workflow(environment=self.environment)
        self.workflow2 = self.create_workflow(environment=self.environment)

    def test_populates_cache_for_each_detector(self) -> None:
        env_id = self.environment.id
        workflows_by_detector = _WorkflowsByDetector(
            {
                self.detector1.id: {self.workflow1},
                self.detector2.id: {self.workflow2},
            }
        )

        _populate_detector_caches(workflows_by_detector, env_id)

        cache1 = _WorkflowCacheAccess(self.detector1.id, env_id)
        cache2 = _WorkflowCacheAccess(self.detector2.id, env_id)
        assert cache1.get() == {self.workflow1}
        assert cache2.get() == {self.workflow2}

    def test_populates_empty_sets(self) -> None:
        env_id = self.environment.id
        workflows_by_detector = _WorkflowsByDetector({self.detector1.id: set()})

        _populate_detector_caches(workflows_by_detector, env_id)

        cache1 = _WorkflowCacheAccess(self.detector1.id, env_id)
        assert cache1.get() == set()
