from __future__ import annotations

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class PreprodArtifactSizeMetricsTest(TestCase):
    """Tests for PreprodArtifact size metrics related methods."""

    def test_get_size_metrics_filtering(self):
        """Test the get_size_metrics method with various filters."""
        artifact = self.create_preprod_artifact(app_id="com.example.filtering")

        main_metrics = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        watch_metrics = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
        )
        feature_metrics = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE,
            identifier="test_feature",
        )

        # Test getting all metrics (no filters)
        all_metrics = artifact.get_size_metrics()
        assert all_metrics.count() == 3

        # Test filtering by metrics type
        main_only = artifact.get_size_metrics(
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )
        assert main_only.count() == 1
        main_first = main_only.first()
        assert main_first is not None
        assert main_first.id == main_metrics.id

        watch_only = artifact.get_size_metrics(
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT
        )
        assert watch_only.count() == 1
        watch_first = watch_only.first()
        assert watch_first is not None
        assert watch_first.id == watch_metrics.id

        # Test filtering by identifier
        feature_only = artifact.get_size_metrics(identifier="test_feature")
        assert feature_only.count() == 1
        feature_first = feature_only.first()
        assert feature_first is not None
        assert feature_first.id == feature_metrics.id

        # Test filtering by both type and identifier
        feature_typed = artifact.get_size_metrics(
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE,
            identifier="test_feature",
        )
        assert feature_typed.count() == 1
        feature_typed_first = feature_typed.first()
        assert feature_typed_first is not None
        assert feature_typed_first.id == feature_metrics.id

        # Test no matches
        no_matches = artifact.get_size_metrics(identifier="nonexistent")
        assert no_matches.count() == 0

    def test_get_size_metrics_for_artifacts_bulk(self):
        """Test the bulk get_size_metrics_for_artifacts classmethod."""
        artifact1 = self.create_preprod_artifact(app_id="com.example.bulk1")
        artifact2 = self.create_preprod_artifact(app_id="com.example.bulk2")

        artifact1_main = self.create_preprod_artifact_size_metrics(
            artifact1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        artifact1_watch = self.create_preprod_artifact_size_metrics(
            artifact1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
        )
        artifact2_main = self.create_preprod_artifact_size_metrics(
            artifact2,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )

        # Test bulk retrieval with no filters (should get all metrics)
        results = PreprodArtifact.get_size_metrics_for_artifacts([artifact1, artifact2])

        assert artifact1.id in results
        assert artifact2.id in results
        assert results[artifact1.id].count() == 2  # main + watch
        assert results[artifact2.id].count() == 1  # main only

        # Test bulk retrieval with type filter (should get only main metrics)
        main_results = PreprodArtifact.get_size_metrics_for_artifacts(
            [artifact1, artifact2],
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )

        assert main_results[artifact1.id].count() == 1
        assert main_results[artifact2.id].count() == 1
        artifact1_main_first = main_results[artifact1.id].first()
        assert artifact1_main_first is not None
        assert artifact1_main_first.id == artifact1_main.id
        artifact2_main_first = main_results[artifact2.id].first()
        assert artifact2_main_first is not None
        assert artifact2_main_first.id == artifact2_main.id

        # Test bulk retrieval with identifier filter
        watch_results = PreprodArtifact.get_size_metrics_for_artifacts(
            [artifact1, artifact2],
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
        )

        assert watch_results[artifact1.id].count() == 1
        assert watch_results[artifact2.id].count() == 0  # No watch metrics for artifact2
        artifact1_watch_first = watch_results[artifact1.id].first()
        assert artifact1_watch_first is not None
        assert artifact1_watch_first.id == artifact1_watch.id

        # Test with empty list
        empty_results = PreprodArtifact.get_size_metrics_for_artifacts([])
        assert empty_results == {}

    def test_get_size_metrics_ignores_other_artifacts(self):
        """Test that get_size_metrics only returns metrics for the specific artifact."""
        artifact1 = self.create_preprod_artifact(app_id="com.example.app1")
        artifact2 = self.create_preprod_artifact(app_id="com.example.app2")

        artifact1_main = self.create_preprod_artifact_size_metrics(
            artifact1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        artifact1_watch = self.create_preprod_artifact_size_metrics(
            artifact1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
        )
        artifact1_feature = self.create_preprod_artifact_size_metrics(
            artifact1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE,
            identifier="feature_a",
        )

        artifact2_main = self.create_preprod_artifact_size_metrics(
            artifact2,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        artifact2_watch = self.create_preprod_artifact_size_metrics(
            artifact2,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
        )
        artifact2_feature = self.create_preprod_artifact_size_metrics(
            artifact2,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE,
            identifier="feature_a",  # Same identifier as artifact1 but different artifact
        )

        # Test artifact1's metrics - should only get artifact1 metrics, not artifact2
        artifact1_metrics = artifact1.get_size_metrics()
        assert artifact1_metrics.count() == 3

        artifact1_ids = {m.id for m in artifact1_metrics}
        expected_artifact1_ids = {artifact1_main.id, artifact1_watch.id, artifact1_feature.id}
        assert artifact1_ids == expected_artifact1_ids

        # Ensure none of artifact2's metrics are included
        artifact2_ids = {artifact2_main.id, artifact2_watch.id, artifact2_feature.id}
        assert artifact1_ids.isdisjoint(artifact2_ids)

        # Test artifact2's metrics - should only get artifact2 metrics, not artifact1
        artifact2_metrics = artifact2.get_size_metrics()
        assert artifact2_metrics.count() == 3

        artifact2_result_ids = {m.id for m in artifact2_metrics}
        assert artifact2_result_ids == artifact2_ids

        # Ensure none of artifact1's metrics are included
        assert artifact2_result_ids.isdisjoint(expected_artifact1_ids)

        # Test filtering by type - should still only return metrics for the specific artifact
        artifact1_main_only = artifact1.get_size_metrics(
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )
        assert artifact1_main_only.count() == 1
        artifact1_main_only_first = artifact1_main_only.first()
        assert artifact1_main_only_first is not None
        assert artifact1_main_only_first.id == artifact1_main.id
        assert artifact1_main_only_first.id != artifact2_main.id

        # Test filtering by identifier - should still only return metrics for the specific artifact
        artifact1_feature_only = artifact1.get_size_metrics(identifier="feature_a")
        assert artifact1_feature_only.count() == 1
        artifact1_feature_only_first = artifact1_feature_only.first()
        assert artifact1_feature_only_first is not None
        assert artifact1_feature_only_first.id == artifact1_feature.id
        assert artifact1_feature_only_first.id != artifact2_feature.id
