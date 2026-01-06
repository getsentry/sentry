from datetime import datetime
from datetime import timezone as dt_timezone
from unittest.mock import patch

from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.eap.write import (
    produce_preprod_build_distribution_to_eap,
    produce_preprod_size_metric_to_eap,
)
from sentry.preprod.models import (
    InstallablePreprodArtifact,
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
    PreprodBuildConfiguration,
)
from sentry.testutils.cases import TestCase


class WritePreprodSizeMetricToEAPTest(TestCase):
    @patch("sentry.preprod.eap.write._eap_producer.produce")
    def test_write_preprod_size_metric_encodes_all_fields_correctly(self, mock_produce):
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

        build_config = PreprodBuildConfiguration.objects.create(
            project=self.project, name="Release"
        )

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
            date_built=datetime(2024, 1, 1, 10, 0, 0, tzinfo=dt_timezone.utc),
        )

        size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="com.example.feature",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_install_size=1000,
            max_install_size=5000,
            min_download_size=500,
            max_download_size=3000,
            processing_version="2.0.0",
            analysis_file_id=123,
        )

        produce_preprod_size_metric_to_eap(
            size_metric=size_metric,
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        mock_produce.assert_called_once()
        topic, payload = mock_produce.call_args[0]

        assert topic.name == "snuba-items"

        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        trace_item = codec.decode(payload.value)

        assert trace_item.organization_id == self.organization.id
        assert trace_item.project_id == self.project.id
        assert trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_PREPROD
        assert trace_item.retention_days == 90

        attrs = trace_item.attributes

        assert attrs["preprod_artifact_id"].int_value == artifact.id
        assert attrs["size_metric_id"].int_value == size_metric.id
        assert (
            attrs["metrics_artifact_type"].int_value
            == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )
        assert attrs["identifier"].string_value == "com.example.feature"
        assert attrs["min_install_size"].int_value == 1000
        assert attrs["max_install_size"].int_value == 5000
        assert attrs["min_download_size"].int_value == 500
        assert attrs["max_download_size"].int_value == 3000
        assert attrs["processing_version"].string_value == "2.0.0"
        assert attrs["analysis_file_id"].int_value == 123

        assert attrs["artifact_type"].int_value == PreprodArtifact.ArtifactType.XCARCHIVE
        assert attrs["artifact_state"].int_value == PreprodArtifact.ArtifactState.PROCESSED
        assert attrs["app_id"].string_value == "com.example.app"
        assert attrs["app_name"].string_value == "Example App"
        assert attrs["build_version"].string_value == "1.2.3"
        assert attrs["build_number"].int_value == 100
        assert attrs["main_binary_identifier"].string_value == "com.example.MainBinary"
        assert artifact.date_built is not None
        assert attrs["artifact_date_built"].int_value == int(artifact.date_built.timestamp())

        assert attrs["build_configuration_name"].string_value == "Release"

        assert attrs["git_head_sha"].string_value == "abc123"
        assert attrs["git_base_sha"].string_value == "def456"
        assert attrs["git_provider"].string_value == "github"
        assert attrs["git_head_repo_name"].string_value == "owner/repo"
        assert attrs["git_base_repo_name"].string_value == "owner/repo"
        assert attrs["git_head_ref"].string_value == "feature/test"
        assert attrs["git_base_ref"].string_value == "main"
        assert attrs["git_pr_number"].int_value == 42

    @patch("sentry.preprod.eap.write._eap_producer.produce")
    def test_write_preprod_size_metric_handles_optional_fields(self, mock_produce):
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        produce_preprod_size_metric_to_eap(
            size_metric=size_metric,
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        mock_produce.assert_called_once()
        topic, payload = mock_produce.call_args[0]

        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        trace_item = codec.decode(payload.value)

        assert trace_item.organization_id == self.organization.id
        assert trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_PREPROD

        attrs = trace_item.attributes

        assert "identifier" not in attrs
        assert "min_install_size" not in attrs
        assert "max_install_size" not in attrs
        assert "build_configuration_name" not in attrs
        assert "git_head_sha" not in attrs


class WritePreprodBuildDistributionToEAPTest(TestCase):
    @patch("sentry.preprod.eap.write._eap_producer.produce")
    def test_write_preprod_build_distribution_encodes_all_fields_correctly(self, mock_produce):
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

        build_config = PreprodBuildConfiguration.objects.create(
            project=self.project, name="Release"
        )

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
            date_built=datetime(2024, 1, 1, 10, 0, 0, tzinfo=dt_timezone.utc),
            installable_app_file_id=456,
            extras={
                "codesigning_type": "AdHoc",
                "profile_name": "Development Profile",
                "profile_expiration_date": "2025-12-31",
                "certificate_expiration_date": "2025-12-31",
                "is_code_signature_valid": True,
                "is_simulator": False,
                "has_missing_dsym_binaries": True,
                "has_proguard_mapping": False,
            },
        )

        # Create multiple installables to test summing
        InstallablePreprodArtifact.objects.create(
            preprod_artifact=artifact,
            url_path="test-url-path-1",
            download_count=42,
        )
        InstallablePreprodArtifact.objects.create(
            preprod_artifact=artifact,
            url_path="test-url-path-2",
            download_count=10,
        )

        produce_preprod_build_distribution_to_eap(
            artifact=artifact,
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        mock_produce.assert_called_once()
        topic, payload = mock_produce.call_args[0]

        assert topic.name == "snuba-items"

        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        trace_item = codec.decode(payload.value)

        assert trace_item.organization_id == self.organization.id
        assert trace_item.project_id == self.project.id
        assert trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_PREPROD
        assert trace_item.retention_days == 90

        attrs = trace_item.attributes

        assert attrs["preprod_artifact_id"].int_value == artifact.id
        assert attrs["sub_item_type"].string_value == "build_distribution"
        assert attrs["artifact_state"].int_value == PreprodArtifact.ArtifactState.PROCESSED
        assert attrs["artifact_type"].int_value == PreprodArtifact.ArtifactType.XCARCHIVE
        assert attrs["app_id"].string_value == "com.example.app"
        assert attrs["app_name"].string_value == "Example App"
        assert attrs["build_version"].string_value == "1.2.3"
        assert attrs["build_number"].int_value == 100
        assert attrs["main_binary_identifier"].string_value == "com.example.MainBinary"
        assert artifact.date_built is not None
        assert attrs["artifact_date_built"].int_value == int(artifact.date_built.timestamp())
        assert attrs["build_configuration_name"].string_value == "Release"

        assert attrs["codesigning_type"].string_value == "AdHoc"
        assert attrs["profile_name"].string_value == "Development Profile"
        assert attrs["profile_expiration_date"].string_value == "2025-12-31"
        assert attrs["certificate_expiration_date"].string_value == "2025-12-31"
        assert attrs["is_code_signature_valid"].bool_value is True
        assert attrs["is_simulator"].bool_value is False
        assert attrs["has_missing_dsym_binaries"].bool_value is True
        assert attrs["has_proguard_mapping"].bool_value is False

        assert attrs["has_installable_file"].bool_value is True
        assert attrs["download_count"].int_value == 52  # 42 + 10 from both installables

        assert attrs["git_head_sha"].string_value == "abc123"
        assert attrs["git_base_sha"].string_value == "def456"
        assert attrs["git_provider"].string_value == "github"
        assert attrs["git_head_repo_name"].string_value == "owner/repo"
        assert attrs["git_base_repo_name"].string_value == "owner/repo"
        assert attrs["git_head_ref"].string_value == "feature/test"
        assert attrs["git_base_ref"].string_value == "main"
        assert attrs["git_pr_number"].int_value == 42

    @patch("sentry.preprod.eap.write._eap_producer.produce")
    def test_write_preprod_build_distribution_handles_optional_fields(self, mock_produce):
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        produce_preprod_build_distribution_to_eap(
            artifact=artifact,
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        mock_produce.assert_called_once()
        topic, payload = mock_produce.call_args[0]

        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        trace_item = codec.decode(payload.value)

        assert trace_item.organization_id == self.organization.id
        assert trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_PREPROD

        attrs = trace_item.attributes

        assert attrs["sub_item_type"].string_value == "build_distribution"
        assert attrs["has_installable_file"].bool_value is False
        assert attrs["download_count"].int_value == 0

        assert "codesigning_type" not in attrs
        assert "profile_name" not in attrs
        assert "build_configuration_name" not in attrs
        assert "git_head_sha" not in attrs
