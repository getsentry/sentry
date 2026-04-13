from sentry.incidents.grouptype import MetricIssue
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.processors.data_source import bulk_fetch_enabled_detectors
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestDataSourceCacheInvalidationSignals(BaseWorkflowTest):
    @with_feature("organizations:cache-detectors-by-data-source")
    def test_cache_invalidated_on_data_source_save(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="ds_signal_test_1", type="test")
        data_source.detectors.set([detector])

        bulk_fetch_enabled_detectors("ds_signal_test_1", "test")

        with self.assertNumQueries(1):
            # 1. Get data source with organization (for feature flag check)
            result = bulk_fetch_enabled_detectors("ds_signal_test_1", "test")
            assert len(result) == 1

        # Update the data source (not a create)
        data_source.save()

        with self.assertNumQueries(2):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss after invalidation)
            result = bulk_fetch_enabled_detectors("ds_signal_test_1", "test")
            assert len(result) == 1
