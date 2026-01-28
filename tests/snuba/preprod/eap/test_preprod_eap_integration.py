import time
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.eap.read import query_preprod_size_metrics
from sentry.preprod.eap.write import produce_preprod_size_metric_to_eap
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
    PreprodBuildConfiguration,
)
from sentry.testutils.cases import SnubaTestCase


class PreprodEAPIntegrationTest(SnubaTestCase):
    def test_write_and_read_size_metric_round_trip(self):
        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="abc123def456",
            base_sha="def456abc123",
            provider="github",
            head_repo_name="owner/repo",
            head_ref="main",
            pr_number=42,
        )

        build_config = PreprodBuildConfiguration.objects.create(
            project=self.project, name="Release"
        )

        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.integrationtest",
            app_name="Integration Test App",
            build_version="1.0.0",
            build_number=100,
            commit_comparison=commit_comparison,
            build_configuration=build_config,
            date_built=datetime(2024, 1, 1, 10, 0, 0, tzinfo=dt_timezone.utc),
        )

        size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="com.example.main",
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

        max_attempts = 20
        found = False

        for attempt in range(max_attempts):
            time.sleep(0.5)

            app_filter = TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name="app_id", type=AttributeKey.Type.TYPE_STRING),
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(val_str="com.example.integrationtest"),
                )
            )

            response = query_preprod_size_metrics(
                organization_id=self.organization.id,
                project_ids=[self.project.id],
                start=datetime.now(dt_timezone.utc) - timedelta(hours=1),
                end=datetime.now(dt_timezone.utc) + timedelta(hours=1),
                referrer="test.preprod.integration",
                filter=app_filter,
            )

            if response.column_values:
                found = True
                break

        assert found, f"Data not found in Snuba after {max_attempts} attempts"

        columns = {cv.attribute_name: idx for idx, cv in enumerate(response.column_values)}

        assert (
            response.column_values[columns["preprod_artifact_id"]].results[0].val_int == artifact.id
        )
        assert (
            response.column_values[columns["size_metric_id"]].results[0].val_int == size_metric.id
        )
        assert (
            response.column_values[columns["metrics_artifact_type"]].results[0].val_int
            == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )
        assert response.column_values[columns["max_install_size"]].results[0].val_int == 5000
        assert response.column_values[columns["max_download_size"]].results[0].val_int == 3000
        assert response.column_values[columns["min_install_size"]].results[0].val_int == 1000
        assert response.column_values[columns["min_download_size"]].results[0].val_int == 500

        assert (
            response.column_values[columns["app_id"]].results[0].val_str
            == "com.example.integrationtest"
        )
        assert (
            response.column_values[columns["app_name"]].results[0].val_str == "Integration Test App"
        )
        assert response.column_values[columns["build_version"]].results[0].val_str == "1.0.0"
        assert response.column_values[columns["build_number"]].results[0].val_int == 100
        assert (
            response.column_values[columns["artifact_type"]].results[0].val_int
            == PreprodArtifact.ArtifactType.XCARCHIVE
        )

        assert (
            response.column_values[columns["build_configuration_name"]].results[0].val_str
            == "Release"
        )
        assert response.column_values[columns["git_head_sha"]].results[0].val_str == "abc123def456"
        assert response.column_values[columns["git_head_ref"]].results[0].val_str == "main"

    def test_write_multiple_size_metrics_same_artifact(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.multitest",
        )

        size_metric_main = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=5000,
        )

        size_metric_watch = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="com.example.watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1000,
        )

        produce_preprod_size_metric_to_eap(
            size_metric=size_metric_main,
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        produce_preprod_size_metric_to_eap(
            size_metric=size_metric_watch,
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        max_attempts = 20
        found_count = 0

        for attempt in range(max_attempts):
            time.sleep(0.5)

            app_filter = TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name="app_id", type=AttributeKey.Type.TYPE_STRING),
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(val_str="com.example.multitest"),
                )
            )

            response = query_preprod_size_metrics(
                organization_id=self.organization.id,
                project_ids=[self.project.id],
                start=datetime.now(dt_timezone.utc) - timedelta(hours=1),
                end=datetime.now(dt_timezone.utc) + timedelta(hours=1),
                referrer="test.preprod.integration",
                filter=app_filter,
            )

            if response.column_values:
                found_count = len(response.column_values[0].results)
            if found_count >= 2:
                break

        assert found_count == 2, f"Expected 2 records, found {found_count}"

        columns = {cv.attribute_name: idx for idx, cv in enumerate(response.column_values)}
        num_rows = len(response.column_values[0].results)
        sizes = {
            response.column_values[columns["max_install_size"]].results[row_idx].val_int
            for row_idx in range(num_rows)
        }
        assert sizes == {5000, 1000}
