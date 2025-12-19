from sentry.issues.grouptype import PreprodDeltaGroupType
from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.issues import artifact_to_tags, diff_to_occurrence
from sentry.preprod.size_analysis.models import SizeMetricDiffItem
from sentry.testutils.cases import TestCase


class DiffToOccurrenceTest(TestCase):
    def test_diff_to_occurrence_install(self):

        project = self.create_project()

        head_artifact = self.create_preprod_artifact(project=project, app_id="com.example.app")
        base_artifact = self.create_preprod_artifact(project=project, app_id="com.example.app")

        head_metric = self.create_preprod_artifact_size_metrics(
            head_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            max_install_size=150,
            max_download_size=400,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        base_metric = self.create_preprod_artifact_size_metrics(
            base_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            max_install_size=100,
            max_download_size=300,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        diff = SizeMetricDiffItem(
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            base_install_size=100,
            head_install_size=150,
            base_download_size=300,
            head_download_size=400,
        )

        occurrence, event = diff_to_occurrence("install", diff, head_metric, base_metric)

        assert occurrence.project_id == project.id
        assert occurrence.issue_title == "Install size regression"
        assert occurrence.subtitle == "50 byte install size regression"
        assert occurrence.type == PreprodDeltaGroupType
        assert occurrence.event_id == event["event_id"]
        assert occurrence.project_id == event["project_id"]
        assert occurrence.detection_time.timestamp() == event["timestamp"]
        assert event["platform"] == "android"
        assert event["tags"]["regression_kind"] == "install"
        assert event["tags"]["head.app_id"] == "com.example.app"
        assert event["tags"]["base.app_id"] == "com.example.app"
        assert len(occurrence.evidence_display) == 0
        assert occurrence.evidence_data["head_artifact_id"] == head_artifact.id
        assert occurrence.evidence_data["base_artifact_id"] == base_artifact.id
        assert occurrence.evidence_data["head_size_metric_id"] == head_metric.id
        assert occurrence.evidence_data["base_size_metric_id"] == base_metric.id

    def test_diff_to_occurrence_download(self):

        project = self.create_project()

        head_artifact = self.create_preprod_artifact(project=project, app_id="com.example.app")
        base_artifact = self.create_preprod_artifact(project=project, app_id="com.example.app")

        head_metric = self.create_preprod_artifact_size_metrics(
            head_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            max_install_size=150,
            max_download_size=500,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        base_metric = self.create_preprod_artifact_size_metrics(
            base_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            max_install_size=100,
            max_download_size=300,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        diff = SizeMetricDiffItem(
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            base_install_size=100,
            head_install_size=150,
            base_download_size=300,
            head_download_size=500,
        )

        occurrence, event = diff_to_occurrence("download", diff, head_metric, base_metric)

        assert occurrence.project_id == project.id
        assert occurrence.issue_title == "Download size regression"
        assert occurrence.subtitle == "200 byte download size regression"
        assert occurrence.type == PreprodDeltaGroupType
        assert occurrence.event_id == event["event_id"]
        assert occurrence.project_id == event["project_id"]
        assert occurrence.detection_time.timestamp() == event["timestamp"]
        assert event["platform"] == "android"
        assert event["tags"]["regression_kind"] == "download"
        assert event["tags"]["head.app_id"] == "com.example.app"
        assert event["tags"]["base.app_id"] == "com.example.app"
        assert len(occurrence.evidence_display) == 0
        assert occurrence.evidence_data["head_artifact_id"] == head_artifact.id
        assert occurrence.evidence_data["base_artifact_id"] == base_artifact.id
        assert occurrence.evidence_data["head_size_metric_id"] == head_metric.id
        assert occurrence.evidence_data["base_size_metric_id"] == base_metric.id


class ArtifactToTagsTest(TestCase):
    def test_artifact_to_tags(self):
        project = self.create_project()

        artifact = self.create_preprod_artifact(
            project=project,
            app_id="com.example.app",
            app_name="Example App",
            build_version="1.2.3",
            build_number=456,
        )

        tags = artifact_to_tags(artifact)

        assert tags["app_id"] == "com.example.app"
        assert tags["app_name"] == "Example App"
        assert tags["build_version"] == "1.2.3"
        assert tags["build_number"] == 456
        assert tags["artifact_type"] == "apk"

    def test_artifact_to_tags_partial(self):
        project = self.create_project()

        artifact = self.create_preprod_artifact(project=project, app_id="com.example.app")

        tags = artifact_to_tags(artifact)

        assert tags["app_id"] == "com.example.app"
        assert "app_name" not in tags
        assert "build_version" not in tags
        assert "build_number" not in tags
