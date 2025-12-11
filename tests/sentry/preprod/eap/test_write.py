from datetime import datetime, timezone as dt_timezone
from unittest.mock import patch

from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.preprod.eap.write import write_preprod_size_metric_to_eap
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.testutils.cases import TestCase


class WritePreprodSizeMetricToEAPTest(TestCase):
    def test_write_preprod_size_metric_to_eap(self):
        """Test that preprod size metrics are correctly written to EAP"""
        # Create a preprod artifact
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        # Create size metrics
        size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_install_size=1000,
            max_install_size=2000,
            min_download_size=500,
            max_download_size=1500,
            processing_version="1.0.0",
            analysis_file_id=123,
        )

        # Mock the Kafka producer
        with patch("sentry.preprod.eap.write.eap_producer") as mock_producer:
            write_preprod_size_metric_to_eap(
                size_metric=size_metric,
                organization_id=self.organization.id,
                project_id=self.project.id,
                timestamp=datetime(2024, 1, 1, 12, 0, 0, tzinfo=dt_timezone.utc),
            )

            # Verify producer was called
            assert mock_producer.produce.called
            call_args = mock_producer.produce.call_args

            # Verify the payload contains the correct trace item
            payload = call_args[0][1]
            trace_item = payload.value  # This is the encoded trace item

            # We can't directly inspect the encoded payload, but we can verify the call was made
            # with the correct topic
            assert call_args[0][0].name == "snuba-items"

    def test_write_preprod_size_metric_with_identifier(self):
        """Test writing size metrics with an identifier (e.g., dynamic features)"""
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        # Create size metrics with an identifier
        size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE,
            identifier="com.example.feature",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=5000,
            max_download_size=3000,
        )

        with patch("sentry.preprod.eap.write.eap_producer") as mock_producer:
            write_preprod_size_metric_to_eap(
                size_metric=size_metric,
                organization_id=self.organization.id,
                project_id=self.project.id,
            )

            # Verify producer was called
            assert mock_producer.produce.called

    def test_write_preprod_size_metric_item_type(self):
        """Test that the correct trace item type is used"""
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        with patch("sentry.preprod.eap.write.eap_producer") as mock_producer:
            with patch("sentry.preprod.eap.write.EAP_ITEMS_CODEC") as mock_codec:
                write_preprod_size_metric_to_eap(
                    size_metric=size_metric,
                    organization_id=self.organization.id,
                    project_id=self.project.id,
                )

                # Verify encode was called with a TraceItem that has the correct item_type
                encode_call = mock_codec.encode.call_args[0][0]
                assert encode_call.item_type == TraceItemType.TRACE_ITEM_TYPE_PREPROD
                assert encode_call.organization_id == self.organization.id
                assert encode_call.project_id == self.project.id

    def test_write_preprod_size_metric_denormalizes_related_data(self):
        """Test that related data from PreprodArtifact, CommitComparison, and BuildConfiguration is denormalized"""
        from sentry.models.commitcomparison import CommitComparison
        from sentry.preprod.models import PreprodBuildConfiguration

        # Create commit comparison
        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="abc123",
            base_sha="def456",
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
            pr_number=42,
        )

        # Create build configuration
        build_config = PreprodBuildConfiguration.objects.create(
            project=self.project, name="Release"
        )

        # Create artifact with all the fields
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            app_name="Example App",
            build_version="1.2.3",
            build_number=100,
            main_binary_identifier="com.example.MainBinary",
            commit_comparison=commit_comparison,
            build_configuration=build_config,
        )

        size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=5000,
            max_download_size=3000,
            processing_version="2.0.0",
        )

        with patch("sentry.preprod.eap.write.eap_producer"):
            with patch("sentry.preprod.eap.write.EAP_ITEMS_CODEC") as mock_codec:
                write_preprod_size_metric_to_eap(
                    size_metric=size_metric,
                    organization_id=self.organization.id,
                    project_id=self.project.id,
                )

                # Verify all denormalized attributes are present
                trace_item = mock_codec.encode.call_args[0][0]
                attrs = trace_item.attributes

                # Size metric attributes
                assert attrs["size_metric_id"].int_value == size_metric.id
                assert attrs["max_install_size"].int_value == 5000
                assert attrs["max_download_size"].int_value == 3000
                assert attrs["processing_version"].string_value == "2.0.0"
                # Note: size_metric_state is NOT included because it's always COMPLETED at write time
                assert "size_metric_state" not in attrs

                # PreprodArtifact attributes
                assert (
                    attrs["artifact_type"].int_value == PreprodArtifact.ArtifactType.XCARCHIVE
                )
                assert attrs["artifact_state"].int_value == PreprodArtifact.ArtifactState.PROCESSED
                assert attrs["app_id"].string_value == "com.example.app"
                assert attrs["app_name"].string_value == "Example App"
                assert attrs["build_version"].string_value == "1.2.3"
                assert attrs["build_number"].int_value == 100
                assert attrs["main_binary_identifier"].string_value == "com.example.MainBinary"

                # BuildConfiguration attributes
                assert attrs["build_configuration_name"].string_value == "Release"

                # CommitComparison (git) attributes
                assert attrs["git_head_sha"].string_value == "abc123"
                assert attrs["git_base_sha"].string_value == "def456"
                assert attrs["git_provider"].string_value == "github"
                assert attrs["git_head_repo_name"].string_value == "owner/repo"
                assert attrs["git_base_repo_name"].string_value == "owner/repo"
                assert attrs["git_head_ref"].string_value == "feature/test"
                assert attrs["git_base_ref"].string_value == "main"
                assert attrs["git_pr_number"].int_value == 42
