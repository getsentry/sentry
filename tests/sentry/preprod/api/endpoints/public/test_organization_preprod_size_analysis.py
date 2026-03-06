from io import BytesIO

from django.urls import reverse

from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.testutils.cases import APITestCase
from sentry.utils import json


class ProjectPreprodPublicSizeAnalysisEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-preprod-artifact-public-size-analysis"

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

        self.file = self.create_file(name="test_artifact.apk", type="application/octet-stream")

        self.preprod_artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.app",
        )
        self.mobile_app_info = self.create_preprod_artifact_mobile_app_info(
            preprod_artifact=self.preprod_artifact,
            build_version="1.0.0",
            build_number=42,
        )

        self.feature_context = self.feature({"organizations:preprod-frontend-routes": True})
        self.feature_context.__enter__()

    def tearDown(self):
        self.feature_context.__exit__(None, None, None)
        super().tearDown()

    def _get_url(self, artifact_id=None):
        artifact_id = artifact_id or self.preprod_artifact.id
        return reverse(
            self.endpoint,
            args=[self.organization.slug, artifact_id],
        )

    def _create_analysis_file(self, data):
        f = self.create_file(name="analysis.json", type="application/json")
        f.putfile(BytesIO(json.dumps(data).encode()))
        return f

    def _make_analysis_data(self, **overrides):
        defaults = {
            "analysis_duration": 1.5,
            "download_size": 512000,
            "install_size": 1024000,
            "analysis_version": "1.0.0",
            "treemap": None,
            "insights": None,
            "file_analysis": None,
            "app_components": None,
        }
        defaults.update(overrides)
        return defaults

    def test_feature_flag_disabled(self):
        with self.feature({"organizations:preprod-frontend-routes": False}):
            response = self.client.get(self._get_url())
            assert response.status_code == 403
            assert response.json()["detail"] == "Feature not enabled"

    def test_artifact_not_found(self):
        response = self.client.get(self._get_url(artifact_id=999999))
        assert response.status_code == 404
        assert "The requested preprod artifact does not exist" in response.json()["detail"]

    def test_no_size_metrics_returns_pending(self):
        response = self.client.get(self._get_url())
        assert response.status_code == 200
        data = response.json()
        assert data["state"] == "PENDING"
        assert data["buildId"] == str(self.preprod_artifact.id)
        assert data["downloadSize"] is None
        assert data["installSize"] is None
        assert data["errorCode"] is None
        assert data["errorMessage"] is None

    def test_pending_state(self):
        self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        )

        response = self.client.get(self._get_url())
        assert response.status_code == 200
        data = response.json()
        assert data["buildId"] == str(self.preprod_artifact.id)
        assert data["state"] == "PENDING"
        assert data["gitInfo"] is None
        assert data["downloadSize"] is None
        assert data["installSize"] is None

    def test_processing_state(self):
        self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
        )

        response = self.client.get(self._get_url())
        assert response.status_code == 200
        data = response.json()
        assert data["state"] == "PROCESSING"

    def test_failed_state(self):
        self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=1,
            error_message="Analysis failed",
        )

        response = self.client.get(self._get_url())
        assert response.status_code == 200
        data = response.json()
        assert data["state"] == "FAILED"
        assert data["errorCode"] == "TIMEOUT"
        assert data["errorMessage"] == "Analysis failed"
        assert data["downloadSize"] is None
        assert data["installSize"] is None

    def test_completed_state(self):
        analysis_data = self._make_analysis_data(
            insights={"platform": "android", "duplicate_files": None},
            app_components=[
                {
                    "component_type": PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
                    "name": "Watch App",
                    "app_id": "com.example.watch",
                    "path": "/watch",
                    "download_size": 100000,
                    "install_size": 200000,
                }
            ],
            treemap={
                "root": {"name": "root", "size": 100, "is_dir": True, "children": []},
                "file_count": 1,
                "category_breakdown": {},
                "platform": "android",
            },
            file_analysis={"items": [{"path": "/test", "hash": "abc123", "children": []}]},
        )
        analysis_file = self._create_analysis_file(analysis_data)

        self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            analysis_file_id=analysis_file.id,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1024000,
            max_download_size=512000,
        )

        response = self.client.get(self._get_url())

        assert response.status_code == 200
        data = response.json()
        assert data["state"] == "COMPLETED"
        assert data["downloadSize"] == 512000
        assert data["installSize"] == 1024000
        assert data["analysisDuration"] == 1.5
        assert data["analysisVersion"] == "1.0.0"
        assert data["insights"]["platform"] == "android"
        assert len(data["appComponents"]) == 1
        assert data["appComponents"][0]["name"] == "Watch App"
        assert data["appComponents"][0]["componentType"] == "WATCH_ARTIFACT"
        assert data["baseBuildId"] is None
        assert data["baseAppInfo"] is None
        assert data["comparisons"] is None
        assert data["errorCode"] is None
        assert data["errorMessage"] is None
        assert "treemap" not in data
        assert "fileAnalysis" not in data

    def test_completed_state_with_base_build(self):
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="1234567890098765432112345678900987654321",
            base_sha="9876543210012345678998765432100123456789",
        )
        self.preprod_artifact.commit_comparison = commit_comparison
        self.preprod_artifact.save()

        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha=commit_comparison.base_sha,
            base_sha="0000000000000000000000000000000000000000",
        )
        base_file = self.create_file(name="base_artifact.apk", type="application/octet-stream")
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=base_file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id=self.preprod_artifact.app_id,
            commit_comparison=base_commit_comparison,
        )
        self.create_preprod_artifact_mobile_app_info(
            preprod_artifact=base_artifact,
            build_version="0.9.0",
            build_number=41,
        )

        analysis_file = self._create_analysis_file(self._make_analysis_data())
        head_size_metric = self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            analysis_file_id=analysis_file.id,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1024000,
            max_download_size=512000,
        )

        base_analysis_file = self.create_file(name="base_analysis.json", type="application/json")
        base_size_metric = self.create_preprod_artifact_size_metrics(
            base_artifact,
            analysis_file_id=base_analysis_file.id,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=900000,
            max_download_size=450000,
        )

        comparison_data = {
            "diff_items": [{"size_diff": 100, "path": "/test", "type": "added"}],
            "insight_diff_items": [],
            "size_metric_diff_item": {
                "metrics_artifact_type": PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                "identifier": None,
                "head_install_size": 1024000,
                "head_download_size": 512000,
                "base_install_size": 900000,
                "base_download_size": 450000,
            },
            "skipped_diff_item_comparison": False,
        }
        comparison_file = self._create_analysis_file(comparison_data)
        self.create_preprod_artifact_size_comparison(
            head_size_analysis=head_size_metric,
            base_size_analysis=base_size_metric,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=comparison_file.id,
        )

        response = self.client.get(self._get_url())

        assert response.status_code == 200
        data = response.json()
        assert data["baseBuildId"] == str(base_artifact.id)
        assert data["baseAppInfo"] is not None
        assert data["comparisons"] is not None
        assert len(data["comparisons"]) == 1
        comparison = data["comparisons"][0]
        assert comparison["state"] == "SUCCESS"
        assert comparison["metricsArtifactType"] == "MAIN_ARTIFACT"
        assert comparison["diffItems"] is not None
        assert comparison["sizeMetricDiff"] is not None
        assert comparison["sizeMetricDiff"]["metricsArtifactType"] == "MAIN_ARTIFACT"

    def test_completed_state_with_explicit_base_id(self):
        base_file = self.create_file(name="base_artifact.apk", type="application/octet-stream")
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=base_file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id=self.preprod_artifact.app_id,
        )
        self.create_preprod_artifact_mobile_app_info(
            preprod_artifact=base_artifact,
            build_version="0.9.0",
            build_number=41,
        )

        analysis_file = self._create_analysis_file(self._make_analysis_data())
        head_size_metric = self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            analysis_file_id=analysis_file.id,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1024000,
            max_download_size=512000,
        )

        base_analysis_file = self.create_file(name="base_analysis.json", type="application/json")
        base_size_metric = self.create_preprod_artifact_size_metrics(
            base_artifact,
            analysis_file_id=base_analysis_file.id,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=900000,
            max_download_size=450000,
        )

        comparison_data = {
            "diff_items": [],
            "insight_diff_items": [],
            "size_metric_diff_item": {
                "metrics_artifact_type": PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                "identifier": None,
                "head_install_size": 1024000,
                "head_download_size": 512000,
                "base_install_size": 900000,
                "base_download_size": 450000,
            },
            "skipped_diff_item_comparison": False,
        }
        comparison_file = self._create_analysis_file(comparison_data)
        self.create_preprod_artifact_size_comparison(
            head_size_analysis=head_size_metric,
            base_size_analysis=base_size_metric,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=comparison_file.id,
        )

        response = self.client.get(self._get_url() + f"?baseArtifactId={base_artifact.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["baseBuildId"] == str(base_artifact.id)
        assert data["comparisons"] is not None

    def test_invalid_base_id(self):
        analysis_file = self._create_analysis_file(self._make_analysis_data())

        self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            analysis_file_id=analysis_file.id,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1024000,
            max_download_size=512000,
        )

        response = self.client.get(self._get_url() + "?baseArtifactId=999999")

        assert response.status_code == 404
        assert "base preprod artifact does not exist" in response.json()["detail"]

    def test_cross_org_artifact_access(self):
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)
        other_file = self.create_file(name="other_artifact.apk", type="application/octet-stream")
        other_artifact = self.create_preprod_artifact(
            project=other_project,
            file_id=other_file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.other.app",
        )

        response = self.client.get(self._get_url(artifact_id=other_artifact.id))
        assert response.status_code == 404
        assert "The requested preprod artifact does not exist" in response.json()["detail"]

    def test_base_artifact_different_org(self):
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)
        other_file = self.create_file(name="other_artifact.apk", type="application/octet-stream")
        other_artifact = self.create_preprod_artifact(
            project=other_project,
            file_id=other_file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.other.app",
        )

        analysis_file = self._create_analysis_file(self._make_analysis_data())

        self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            analysis_file_id=analysis_file.id,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1024000,
            max_download_size=512000,
        )

        response = self.client.get(self._get_url() + f"?baseArtifactId={other_artifact.id}")

        assert response.status_code == 404
        assert "base preprod artifact does not exist" in response.json()["detail"]
