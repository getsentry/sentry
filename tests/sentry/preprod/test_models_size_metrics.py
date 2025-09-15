from __future__ import annotations

from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.silo import region_silo_test


@region_silo_test
class PreprodArtifactSizeMetricsTest(TestCase):
    """Tests for PreprodArtifact size metrics related methods."""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )

    def test_get_size_metrics_filtering(self):
        """Test the get_size_metrics method with various filters."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.filtering",
        )

        # Create multiple metrics with different types and identifiers
        main_metrics = Factories.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        watch_metrics = Factories.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
        )
        feature_metrics = Factories.create_preprod_artifact_size_metrics(
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
        assert main_only.first().id == main_metrics.id

        watch_only = artifact.get_size_metrics(
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT
        )
        assert watch_only.count() == 1
        assert watch_only.first().id == watch_metrics.id

        # Test filtering by identifier
        feature_only = artifact.get_size_metrics(identifier="test_feature")
        assert feature_only.count() == 1
        assert feature_only.first().id == feature_metrics.id

        # Test filtering by both type and identifier
        feature_typed = artifact.get_size_metrics(
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE,
            identifier="test_feature",
        )
        assert feature_typed.count() == 1
        assert feature_typed.first().id == feature_metrics.id

        # Test no matches
        no_matches = artifact.get_size_metrics(identifier="nonexistent")
        assert no_matches.count() == 0

    def test_get_size_metrics_for_artifacts_bulk(self):
        """Test the bulk get_size_metrics_for_artifacts classmethod."""
        # Create multiple artifacts
        artifact1 = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.bulk1",
        )
        artifact2 = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.bulk2",
        )

        # Create metrics for each
        artifact1_main = Factories.create_preprod_artifact_size_metrics(
            artifact1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        artifact1_watch = Factories.create_preprod_artifact_size_metrics(
            artifact1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
        )
        artifact2_main = Factories.create_preprod_artifact_size_metrics(
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
        assert main_results[artifact1.id].first().id == artifact1_main.id
        assert main_results[artifact2.id].first().id == artifact2_main.id

        # Test bulk retrieval with identifier filter
        watch_results = PreprodArtifact.get_size_metrics_for_artifacts(
            [artifact1, artifact2],
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
        )

        assert watch_results[artifact1.id].count() == 1
        assert watch_results[artifact2.id].count() == 0  # No watch metrics for artifact2
        assert watch_results[artifact1.id].first().id == artifact1_watch.id

        # Test with empty list
        empty_results = PreprodArtifact.get_size_metrics_for_artifacts([])
        assert empty_results == {}

    def test_get_base_size_metrics_all_states(self):
        """Test get_base_size_metrics works with different size analysis states."""
        head_commit_comparison = CommitComparison.objects.create(
            head_repo_name="test/repo",
            head_sha="head_state_test",
            base_sha="base_state_test",
            provider="github",
            organization_id=self.organization.id,
        )
        base_commit_comparison = CommitComparison.objects.create(
            head_repo_name="test/repo",
            head_sha="base_state_test",
            provider="github",
            organization_id=self.organization.id,
        )
        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=base_commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.statetest",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            build_version="1.0.0",
            build_number=1,
        )
        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=head_commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.statetest",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            build_version="1.0.1",
            build_number=2,
        )

        # Create noise data: artifacts and metrics from different commits that shouldn't be picked up
        noise_commit_comparison = CommitComparison.objects.create(
            head_repo_name="test/repo",
            head_sha="noise_commit_sha",
            provider="github",
            organization_id=self.organization.id,
        )
        noise_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=noise_commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.statetest",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            build_version="2.0.0",
            build_number=10,
        )
        Factories.create_preprod_artifact_size_metrics(
            noise_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            min_download_size=5 * 1024 * 1024,  # Different size to distinguish
            max_download_size=5 * 1024 * 1024,
        )

        states_to_test = [
            PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
            PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
            PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
        ]

        for state in states_to_test:
            with self.subTest(state=state):
                # Clean up any existing metrics before creating new ones, needed for our unique constraint
                PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=base_artifact).delete()

                base_metrics = Factories.create_preprod_artifact_size_metrics(
                    base_artifact,
                    state=state,
                    min_download_size=(
                        1024 * 1024
                        if state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
                        else None
                    ),
                    max_download_size=(
                        1024 * 1024
                        if state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
                        else None
                    ),
                    min_install_size=(
                        2 * 1024 * 1024
                        if state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
                        else None
                    ),
                    max_install_size=(
                        2 * 1024 * 1024
                        if state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
                        else None
                    ),
                )

                found_metrics_qs = head_artifact.get_base_size_metrics(
                    PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
                )
                assert found_metrics_qs.exists()
                found_metrics = found_metrics_qs.first()
                assert found_metrics.id == base_metrics.id
                assert found_metrics.state == state
                # Verify it didn't pick up the noise metrics by checking the exact model ID
                noise_metrics_ids = list(
                    PreprodArtifactSizeMetrics.objects.filter(
                        preprod_artifact=noise_artifact
                    ).values_list("id", flat=True)
                )
                assert found_metrics.id not in noise_metrics_ids

    def test_get_base_size_metrics_filtering_and_bulk_operation(self):
        """Test that get_base_size_metrics filtering works correctly with comprehensive scenarios."""
        head_commit_comparison = CommitComparison.objects.create(
            head_repo_name="test/repo",
            head_sha="head_matching_test",
            base_sha="base_matching_test",
            provider="github",
            organization_id=self.organization.id,
        )
        base_commit_comparison = CommitComparison.objects.create(
            head_repo_name="test/repo",
            head_sha="base_matching_test",
            provider="github",
            organization_id=self.organization.id,
        )
        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=base_commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.matching",
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            build_version="2.0.0",
            build_number=10,
        )

        # Create multiple metrics with different types and identifiers
        main_metrics = Factories.create_preprod_artifact_size_metrics(
            base_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            min_download_size=3 * 1024 * 1024,
            max_download_size=3 * 1024 * 1024,
            min_install_size=6 * 1024 * 1024,
            max_install_size=6 * 1024 * 1024,
        )
        watch_metrics = Factories.create_preprod_artifact_size_metrics(
            base_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            min_download_size=1 * 1024 * 1024,
            max_download_size=1 * 1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )
        feature_metrics = Factories.create_preprod_artifact_size_metrics(
            base_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE,
            identifier="test_feature",
            min_download_size=512 * 1024,
            max_download_size=512 * 1024,
            min_install_size=1024 * 1024,
            max_install_size=1024 * 1024,
        )

        # Create noise data: artifacts and metrics from different commits and organizations
        noise_commit_comparison = CommitComparison.objects.create(
            head_repo_name="test/repo",
            head_sha="noise_commit_different",
            provider="github",
            organization_id=self.organization.id,
        )
        noise_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=noise_commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.matching",  # Same app_id but different commit
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            build_version="3.0.0",
            build_number=50,
        )
        Factories.create_preprod_artifact_size_metrics(
            noise_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            min_download_size=10 * 1024 * 1024,  # Different size to distinguish
            max_download_size=10 * 1024 * 1024,
        )
        Factories.create_preprod_artifact_size_metrics(
            noise_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            min_download_size=8 * 1024 * 1024,  # Different size to distinguish
            max_download_size=8 * 1024 * 1024,
        )
        unrelated_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=base_commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.unrelated",  # Different app_id
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            build_version="2.0.0",
            build_number=10,
        )
        Factories.create_preprod_artifact_size_metrics(
            unrelated_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            min_download_size=7 * 1024 * 1024,  # Different size to distinguish
            max_download_size=7 * 1024 * 1024,
        )

        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=head_commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.matching",
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            build_version="2.0.1",
            build_number=11,
        )

        # Test getting all base metrics (no filters should return all 3)
        all_base_metrics = head_artifact.get_base_size_metrics()
        assert all_base_metrics.count() == 3
        metric_ids = {m.id for m in all_base_metrics}
        assert main_metrics.id in metric_ids
        assert watch_metrics.id in metric_ids
        assert feature_metrics.id in metric_ids
        # Verify noise metrics are NOT included by checking exact model IDs
        noise_metrics_ids = set(
            PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=noise_artifact).values_list(
                "id", flat=True
            )
        )
        unrelated_metrics_ids = set(
            PreprodArtifactSizeMetrics.objects.filter(
                preprod_artifact=unrelated_artifact
            ).values_list("id", flat=True)
        )
        assert not metric_ids.intersection(noise_metrics_ids), "Found noise metrics in results"
        assert not metric_ids.intersection(
            unrelated_metrics_ids
        ), "Found unrelated metrics in results"

        # Test finding specific metric types
        found_main_qs = head_artifact.get_base_size_metrics(
            PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )
        assert found_main_qs.count() == 1
        found_main = found_main_qs.first()
        assert found_main.id == main_metrics.id
        assert found_main.max_download_size == 3 * 1024 * 1024

        found_watch_qs = head_artifact.get_base_size_metrics(
            PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT
        )
        assert found_watch_qs.count() == 1
        found_watch = found_watch_qs.first()
        assert found_watch.id == watch_metrics.id
        assert found_watch.max_download_size == 1 * 1024 * 1024

        # Test finding feature metrics with identifier
        found_feature_qs = head_artifact.get_base_size_metrics(
            PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE, "test_feature"
        )
        assert found_feature_qs.count() == 1
        found_feature = found_feature_qs.first()
        assert found_feature.id == feature_metrics.id
        assert found_feature.max_download_size == 512 * 1024

        # Test not finding feature metrics with wrong identifier
        not_found_feature_qs = head_artifact.get_base_size_metrics(
            PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE, "wrong_feature"
        )
        assert not_found_feature_qs.count() == 0

        # Test not finding non-existent metric type with identifier
        not_found_qs = head_artifact.get_base_size_metrics(
            PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            "some_identifier",  # Watch artifact doesn't have this identifier
        )
        assert not_found_qs.count() == 0
