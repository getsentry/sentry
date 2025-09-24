from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse

from sentry.models.files.file import File
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
    PreprodBuildConfiguration,
)
from sentry.testutils.cases import APITestCase


class ProjectPreprodSizeAnalysisCompareTest(APITestCase):
    endpoint = "sentry-api-0-project-preprod-artifact-size-analysis-compare"
    method = "get"

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

        # Create test files
        self.head_file = File.objects.create(
            name="head_artifact.apk", type="application/octet-stream"
        )
        self.base_file = File.objects.create(
            name="base_artifact.apk", type="application/octet-stream"
        )
        self.head_analysis_file = File.objects.create(
            name="head_analysis.json", type="application/json"
        )
        self.base_analysis_file = File.objects.create(
            name="base_analysis.json", type="application/json"
        )

        # Create head artifact
        self.head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.head_file.id,
            app_name="TestApp",
            app_id="com.test.app",
            build_version="2.0.0",
            build_number=2,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        # Create base artifact
        self.base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.base_file.id,
            app_name="TestApp",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        # Create size metrics for head artifact
        self.head_size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.head_artifact,
            analysis_file_id=self.head_analysis_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1000,
            max_download_size=500,
        )

        # Create size metrics for base artifact
        self.base_size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.base_artifact,
            analysis_file_id=self.base_analysis_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1000,
            max_download_size=500,
        )

    def _get_url(self, head_artifact_id=None, base_artifact_id=None):
        head_artifact_id = head_artifact_id or self.head_artifact.id
        base_artifact_id = base_artifact_id or self.base_artifact.id
        return reverse(
            "sentry-api-0-project-preprod-artifact-size-analysis-compare",
            args=[self.organization.slug, self.project.slug, head_artifact_id, base_artifact_id],
        )

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_success_with_completed_comparison(self):
        """Test GET endpoint returns successful comparison when comparison exists and is completed"""
        # Create a successful comparison
        comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=self.head_size_metric,
            base_size_analysis=self.base_size_metric,
            organization_id=self.organization.id,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=12345,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            self.base_artifact.id,
        )

        data = response.data
        assert data["head_build_details"]["id"] == str(self.head_artifact.id)
        assert data["base_build_details"]["id"] == str(self.base_artifact.id)
        assert len(data["comparisons"]) == 1

        comparison_data = data["comparisons"][0]
        assert comparison_data["head_size_metric_id"] == self.head_size_metric.id
        assert comparison_data["base_size_metric_id"] == self.base_size_metric.id
        assert (
            comparison_data["metrics_artifact_type"]
            == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )
        assert comparison_data["identifier"] == "main"
        assert comparison_data["state"] == PreprodArtifactSizeComparison.State.SUCCESS
        assert comparison_data["comparison_id"] == comparison.id
        assert comparison_data["error_code"] is None
        assert comparison_data["error_message"] is None

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_success_with_failed_comparison(self):
        """Test GET endpoint returns failed comparison when comparison exists and failed"""
        # Create a failed comparison
        comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=self.head_size_metric,
            base_size_analysis=self.base_size_metric,
            organization_id=self.organization.id,
            state=PreprodArtifactSizeComparison.State.FAILED,
            error_code=PreprodArtifactSizeComparison.ErrorCode.UNKNOWN,
            error_message="Comparison failed due to processing error",
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            self.base_artifact.id,
        )
        data = response.data
        comparison_data = data["comparisons"][0]
        assert comparison_data["state"] == PreprodArtifactSizeComparison.State.FAILED
        assert comparison_data["comparison_id"] == comparison.id
        assert comparison_data["error_code"] == str(PreprodArtifactSizeComparison.ErrorCode.UNKNOWN)
        assert comparison_data["error_message"] == "Comparison failed due to processing error"

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_success_with_processing_comparison(self):
        """Test GET endpoint returns processing comparison when comparison is in progress"""
        # Create a processing comparison
        comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=self.head_size_metric,
            base_size_analysis=self.base_size_metric,
            organization_id=self.organization.id,
            state=PreprodArtifactSizeComparison.State.PROCESSING,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            self.base_artifact.id,
        )
        data = response.data
        comparison_data = data["comparisons"][0]
        assert comparison_data["state"] == PreprodArtifactSizeComparison.State.PROCESSING
        assert comparison_data["comparison_id"] == comparison.id
        assert comparison_data["error_code"] is None
        assert comparison_data["error_message"] is None

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_success_with_pending_comparison(self):
        """Test GET endpoint returns pending comparison when no comparison exists yet"""
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            self.base_artifact.id,
        )
        data = response.data
        comparison_data = data["comparisons"][0]
        assert comparison_data["state"] == PreprodArtifactSizeComparison.State.PENDING
        assert comparison_data["comparison_id"] is None
        assert comparison_data["error_code"] is None
        assert comparison_data["error_message"] is None

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_success_with_no_matching_base_metric(self):
        """Test GET endpoint handles case where no matching base metric exists"""
        # Create a head metric with different identifier
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.head_artifact,
            analysis_file_id=self.head_analysis_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            self.base_artifact.id,
        )
        data = response.data
        assert len(data["comparisons"]) == 2  # main + watch

        # Find the watch comparison
        watch_comparison = next(
            (c for c in data["comparisons"] if c["identifier"] == "watch"), None
        )
        assert watch_comparison is not None
        assert watch_comparison["state"] == PreprodArtifactSizeComparison.State.FAILED
        assert watch_comparison["error_code"] == "NO_BASE_METRIC"
        assert watch_comparison["error_message"] == "No matching base artifact size metric found."

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_head_artifact_not_found(self):
        """Test GET endpoint returns 404 when head artifact doesn't exist"""
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            999999,
            self.base_artifact.id,
            status_code=404,
        )
        assert "The requested head preprod artifact does not exist" in response.data["detail"]

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_base_artifact_not_found(self):
        """Test GET endpoint returns 404 when base artifact doesn't exist"""
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            999999,
            status_code=404,
        )
        assert "The requested base preprod artifact does not exist" in response.data["detail"]

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_head_artifact_wrong_project(self):
        """Test GET endpoint returns 404 when head artifact belongs to different project"""
        other_project = self.create_project(organization=self.organization)
        other_artifact = PreprodArtifact.objects.create(
            project=other_project,
            app_name="OtherApp",
            app_id="com.other.app",
            build_version="1.0.0",
            build_number=1,
        )

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            other_artifact.id,
            self.base_artifact.id,
            status_code=404,
        )
        assert response.data["detail"] == "The requested head preprod artifact does not exist"

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_base_artifact_wrong_project(self):
        """Test GET endpoint returns 404 when base artifact belongs to different project"""
        other_project = self.create_project(organization=self.organization)
        other_artifact = PreprodArtifact.objects.create(
            project=other_project,
            app_name="OtherApp",
            app_id="com.other.app",
            build_version="1.0.0",
            build_number=1,
        )

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            other_artifact.id,
            status_code=404,
        )
        assert response.data["detail"] == "The requested base preprod artifact does not exist"

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_head_artifact_no_size_metrics(self):
        """Test GET endpoint returns 404 when head artifact has no size metrics"""
        # Create artifact without size metrics
        artifact_no_metrics = PreprodArtifact.objects.create(
            project=self.project,
            app_name="NoMetricsApp",
            app_id="com.nometrics.app",
            build_version="1.0.0",
            build_number=1,
        )

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            artifact_no_metrics.id,
            self.base_artifact.id,
            status_code=404,
        )
        assert (
            f"Head PreprodArtifact with id {artifact_no_metrics.id} has no size metrics"
            in response.data["detail"]
        )

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_base_artifact_no_size_metrics(self):
        """Test GET endpoint returns 404 when base artifact has no size metrics"""
        # Create artifact without size metrics
        artifact_no_metrics = PreprodArtifact.objects.create(
            project=self.project,
            app_name="NoMetricsApp",
            app_id="com.nometrics.app",
            build_version="1.0.0",
            build_number=1,
        )

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            artifact_no_metrics.id,
            status_code=404,
        )
        assert (
            f"Base PreprodArtifact with id {artifact_no_metrics.id} has no size metrics"
            in response.data["detail"]
        )

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": False})
    def test_get_comparison_feature_disabled(self):
        """Test GET endpoint returns 403 when feature flag is disabled"""
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            self.base_artifact.id,
            status_code=403,
        )
        assert response.data["error"] == "Feature not enabled"

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    @patch("sentry.preprod.size_analysis.tasks.manual_size_analysis_comparison.apply_async")
    def test_post_comparison_success(self, mock_apply_async):
        """Test POST endpoint successfully triggers comparison"""
        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            self.base_artifact.id,
            method="post",
        )
        mock_apply_async.assert_called_once_with(
            kwargs={
                "project_id": self.project.id,
                "org_id": self.organization.id,
                "head_artifact_id": self.head_artifact.id,
                "base_artifact_id": self.base_artifact.id,
            }
        )

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_post_comparison_head_artifact_not_found(self):
        """Test POST endpoint returns 404 when head artifact doesn't exist"""
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            999999,
            self.base_artifact.id,
            method="post",
            status_code=404,
        )
        assert "The requested head preprod artifact does not exist" in response.data["detail"]

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_post_comparison_base_artifact_not_found(self):
        """Test POST endpoint returns 404 when base artifact doesn't exist"""
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            999999,
            method="post",
            status_code=404,
        )
        assert "The requested base preprod artifact does not exist" in response.data["detail"]

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_post_comparison_head_artifact_no_size_metrics(self):
        """Test POST endpoint returns 404 when head artifact has no size metrics"""
        artifact_no_metrics = PreprodArtifact.objects.create(
            project=self.project,
            app_name="NoMetricsApp",
            app_id="com.nometrics.app",
            build_version="1.0.0",
            build_number=1,
        )

        response = self.client.post(self._get_url(head_artifact_id=artifact_no_metrics.id))

        assert response.status_code == 404
        assert (
            f"Head PreprodArtifact with id {artifact_no_metrics.id} has no size metrics"
            in response.json()["detail"]
        )

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_post_comparison_base_artifact_no_size_metrics(self):
        """Test POST endpoint returns 404 when base artifact has no size metrics"""
        artifact_no_metrics = PreprodArtifact.objects.create(
            project=self.project,
            app_name="NoMetricsApp",
            app_id="com.nometrics.app",
            build_version="1.0.0",
            build_number=1,
        )

        response = self.client.post(self._get_url(base_artifact_id=artifact_no_metrics.id))

        assert response.status_code == 404
        assert (
            f"Base PreprodArtifact with id {artifact_no_metrics.id} has no size metrics"
            in response.json()["detail"]
        )

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_post_comparison_head_artifact_processing(self):
        """Test POST endpoint returns 202 when head artifact size metrics are still processing"""
        # Set head size metric to processing state
        self.head_size_metric.state = PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING
        self.head_size_metric.save()

        response = self.client.post(self._get_url())

        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "processing"
        assert (
            f"Head PreprodArtifact with id {self.head_artifact.id} has no completed size metrics yet"
            in data["message"]
        )

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_post_comparison_base_artifact_processing(self):
        """Test POST endpoint returns 202 when base artifact size metrics are still processing"""
        # Set base size metric to processing state
        self.base_size_metric.state = PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING
        self.base_size_metric.save()

        response = self.client.post(self._get_url())

        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "processing"
        assert (
            f"Base PreprodArtifact with id {self.base_artifact.id} has no completed size metrics yet"
            in data["message"]
        )

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_post_comparison_existing_comparison(self):
        """Test POST endpoint returns existing comparison when comparison already exists"""
        # Create an existing comparison
        comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=self.head_size_metric,
            base_size_analysis=self.base_size_metric,
            organization_id=self.organization.id,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=12345,
        )

        response = self.client.post(self._get_url())

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "exists"
        assert "A comparison already exists for the head and base size metrics" in data["message"]
        assert len(data["existing_comparisons"]) == 1
        assert data["existing_comparisons"][0]["comparison_id"] == comparison.id

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_post_comparison_existing_failed_comparison(self):
        """Test POST endpoint returns existing failed comparison when comparison exists and failed"""
        # Create a failed comparison
        comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=self.head_size_metric,
            base_size_analysis=self.base_size_metric,
            organization_id=self.organization.id,
            state=PreprodArtifactSizeComparison.State.FAILED,
            error_code=PreprodArtifactSizeComparison.ErrorCode.UNKNOWN,
            error_message="Processing failed",
        )

        response = self.client.post(self._get_url())

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "exists"
        assert len(data["existing_comparisons"]) == 1
        comparison_data = data["existing_comparisons"][0]
        assert comparison_data["state"] == comparison.state
        assert comparison_data["error_code"] == str(comparison.error_code)
        assert comparison_data["error_message"] == comparison.error_message

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_post_comparison_cannot_compare_size_metrics(self):
        """Test POST endpoint returns 400 when size metrics cannot be compared"""
        # Create additional head metric to make the lists different lengths
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.head_artifact,
            analysis_file_id=self.head_analysis_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )
        # Don't create a matching base metric, so lengths will be different

        response = self.client.post(self._get_url())

        assert response.status_code == 400
        assert "Head and base size metrics cannot be compared" in response.json()["detail"]

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    @patch("sentry.preprod.size_analysis.tasks.manual_size_analysis_comparison.apply_async")
    def test_post_comparison_multiple_metrics(self, mock_apply_async):
        """Test POST endpoint handles multiple size metrics correctly"""
        # Create additional size metrics
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.head_artifact,
            analysis_file_id=self.head_analysis_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.base_artifact,
            analysis_file_id=self.base_analysis_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        response = self.client.post(self._get_url())

        assert response.status_code == 200

        mock_apply_async.assert_called_once_with(
            kwargs={
                "project_id": self.project.id,
                "org_id": self.organization.id,
                "head_artifact_id": self.head_artifact.id,
                "base_artifact_id": self.base_artifact.id,
            }
        )

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_post_comparison_no_matching_base_metric(self):
        """Test POST endpoint returns 400 when head and base metrics cannot be compared"""
        # Create head metric with different identifier that won't match base
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.head_artifact,
            analysis_file_id=self.head_analysis_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        response = self.client.post(self._get_url())

        assert response.status_code == 400
        assert "Head and base size metrics cannot be compared" in response.json()["detail"]

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_get_comparison_multiple_metrics(self):
        """Test GET endpoint handles multiple size metrics correctly"""
        # Create additional size metrics
        head_watch_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.head_artifact,
            analysis_file_id=self.head_analysis_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        base_watch_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.base_artifact,
            analysis_file_id=self.base_analysis_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        # Create comparison for watch metrics
        watch_comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=head_watch_metric,
            base_size_analysis=base_watch_metric,
            organization_id=self.organization.id,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            self.base_artifact.id,
        )
        data = response.data
        assert len(data["comparisons"]) == 2

        # Check main artifact comparison
        main_comparison = next((c for c in data["comparisons"] if c["identifier"] == "main"), None)
        assert main_comparison is not None
        assert main_comparison["head_size_metric_id"] == self.head_size_metric.id
        assert main_comparison["base_size_metric_id"] == self.base_size_metric.id

        # Check watch artifact comparison
        watch_comparison_data = next(
            (c for c in data["comparisons"] if c["identifier"] == "watch"), None
        )
        assert watch_comparison_data is not None
        assert watch_comparison_data["head_size_metric_id"] == head_watch_metric.id
        assert watch_comparison_data["base_size_metric_id"] == base_watch_metric.id
        assert watch_comparison_data["comparison_id"] == watch_comparison.id

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_post_comparison_different_build_configurations(self):
        """Test POST endpoint returns 400 when artifacts have different build configurations"""
        # Create a build configuration for the base artifact
        debug_config = PreprodBuildConfiguration.objects.create(project=self.project, name="debug")

        # Update base artifact to have different build configuration
        self.base_artifact.build_configuration = debug_config
        self.base_artifact.save()

        # Head artifact will have None/default, base will have debug config
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.head_artifact.id,
            self.base_artifact.id,
            method="post",
            status_code=400,
        )
        assert response.data["error"] == "Head and base build configurations must be the same."
