from io import BytesIO
from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.testutils.cases import APITestCase
from sentry.utils import json


class ProjectPreprodPublicSizeAnalysisEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-preprod-artifact-public-size-analysis"

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
            args=[self.organization.slug, self.project.slug, artifact_id],
        )

    def test_feature_flag_disabled(self):
        with self.feature({"organizations:preprod-frontend-routes": False}):
            response = self.client.get(self._get_url())
            assert response.status_code == 403
            assert response.json()["detail"] == "Feature not enabled"

    def test_artifact_not_found(self):
        response = self.client.get(self._get_url(artifact_id=999999))
        assert response.status_code == 404
        assert "The requested head preprod artifact does not exist" in response.json()["detail"]

    def test_no_size_metrics(self):
        response = self.client.get(self._get_url())
        assert response.status_code == 404
        assert response.json()["detail"] == "Size analysis is not available for this artifact"

    def test_pending_state(self):
        self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        )

        response = self.client.get(self._get_url())
        assert response.status_code == 200
        data = response.json()
        assert data["build_id"] == str(self.preprod_artifact.id)
        assert data["state"] == "PENDING"
        assert data["git_info"] is None
        assert "download_size" not in data
        assert "install_size" not in data

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
        assert data["error_code"] == 1
        assert data["error_message"] == "Analysis failed"

    def test_completed_state(self):
        analysis_file = self.create_file(name="analysis.json", type="application/json")
        analysis_data = {
            "analysis_duration": 1.5,
            "download_size": 512000,
            "install_size": 1024000,
            "analysis_version": "1.0.0",
            "treemap": None,
            "insights": None,
            "file_analysis": None,
            "app_components": None,
        }
        with patch.object(analysis_file, "getfile") as mock_getfile:
            mock_file = MagicMock()
            mock_file.read.return_value = json.dumps(analysis_data).encode()
            mock_getfile.return_value = mock_file

            self.create_preprod_artifact_size_metrics(
                self.preprod_artifact,
                analysis_file_id=analysis_file.id,
                metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=1024000,
                max_download_size=512000,
            )

            # Re-mock since we need to mock File.objects.get
            with patch(
                "sentry.preprod.api.endpoints.public.project_preprod_size_analysis.File"
            ) as MockFile:
                mock_file_obj = MagicMock()
                mock_fp = BytesIO(json.dumps(analysis_data).encode())
                mock_file_obj.getfile.return_value = mock_fp
                MockFile.objects.get.return_value = mock_file_obj

                response = self.client.get(self._get_url())

        assert response.status_code == 200
        data = response.json()
        assert data["state"] == "COMPLETED"
        assert data["download_size"] == 512000
        assert data["install_size"] == 1024000
        assert data["analysis_duration"] == 1.5
        assert data["analysis_version"] == "1.0.0"

    def test_completed_with_insights(self):
        analysis_data = {
            "analysis_duration": 1.5,
            "download_size": 512000,
            "install_size": 1024000,
            "analysis_version": "1.0.0",
            "treemap": {
                "root": {"name": "root", "size": 100, "is_dir": True, "children": []},
                "file_count": 1,
                "category_breakdown": {},
                "platform": "android",
            },
            "insights": {"platform": "android", "duplicate_files": None},
            "file_analysis": {"items": []},
            "app_components": [
                {
                    "component_type": PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
                    "name": "Watch App",
                    "app_id": "com.example.watch",
                    "path": "/watch",
                    "download_size": 100000,
                    "install_size": 200000,
                }
            ],
        }

        self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            analysis_file_id=1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1024000,
            max_download_size=512000,
        )

        with patch(
            "sentry.preprod.api.endpoints.public.project_preprod_size_analysis.File"
        ) as MockFile:
            mock_file_obj = MagicMock()
            mock_fp = BytesIO(json.dumps(analysis_data).encode())
            mock_file_obj.getfile.return_value = mock_fp
            MockFile.objects.get.return_value = mock_file_obj

            response = self.client.get(self._get_url())

        assert response.status_code == 200
        data = response.json()
        assert data["insights"] is not None
        assert data["insights"]["platform"] == "android"
        assert data["app_components"] is not None
        assert len(data["app_components"]) == 1
        assert data["app_components"][0]["name"] == "Watch App"

    def test_excludes_treemap_and_file_analysis(self):
        analysis_data = {
            "analysis_duration": 1.5,
            "download_size": 512000,
            "install_size": 1024000,
            "analysis_version": "1.0.0",
            "treemap": {
                "root": {"name": "root", "size": 100, "is_dir": True, "children": []},
                "file_count": 1,
                "category_breakdown": {},
                "platform": "android",
            },
            "insights": None,
            "file_analysis": {"items": [{"path": "/test", "hash": "abc123", "children": []}]},
            "app_components": None,
        }

        self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            analysis_file_id=1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1024000,
            max_download_size=512000,
        )

        with patch(
            "sentry.preprod.api.endpoints.public.project_preprod_size_analysis.File"
        ) as MockFile:
            mock_file_obj = MagicMock()
            mock_fp = BytesIO(json.dumps(analysis_data).encode())
            mock_file_obj.getfile.return_value = mock_fp
            MockFile.objects.get.return_value = mock_file_obj

            response = self.client.get(self._get_url())

        assert response.status_code == 200
        data = response.json()
        assert "treemap" not in data
        assert "file_analysis" not in data

    def test_with_base_artifact_comparison(self):
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

        head_analysis_file = self.create_file(name="head_analysis.json", type="application/json")
        head_size_metric = self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            analysis_file_id=head_analysis_file.id,
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

        comparison_file = self.create_file(name="comparison.json", type="application/json")
        self.create_preprod_artifact_size_comparison(
            head_size_analysis=head_size_metric,
            base_size_analysis=base_size_metric,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=comparison_file.id,
        )

        analysis_data = {
            "analysis_duration": 1.5,
            "download_size": 512000,
            "install_size": 1024000,
            "analysis_version": "1.0.0",
            "treemap": None,
            "insights": None,
            "file_analysis": None,
            "app_components": None,
        }
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

        def get_file_side_effect(id):
            mock_file = MagicMock()
            if id == head_analysis_file.id:
                mock_file.getfile.return_value = BytesIO(json.dumps(analysis_data).encode())
            elif id == comparison_file.id:
                mock_file.getfile.return_value = BytesIO(json.dumps(comparison_data).encode())
            return mock_file

        with (
            patch(
                "sentry.preprod.api.endpoints.public.project_preprod_size_analysis.File"
            ) as MockFile,
            patch("sentry.preprod.api.models.public_api_models.File") as MockModelsFile,
        ):
            MockFile.objects.get.side_effect = get_file_side_effect
            MockFile.DoesNotExist = Exception
            MockModelsFile.objects.get.side_effect = get_file_side_effect
            MockModelsFile.DoesNotExist = Exception

            response = self.client.get(self._get_url())

        assert response.status_code == 200
        data = response.json()
        assert data["base_build_id"] == str(base_artifact.id)
        assert data["base_app_info"] is not None
        assert data["comparisons"] is not None
        assert len(data["comparisons"]) == 1
        comparison = data["comparisons"][0]
        assert comparison["state"] == PreprodArtifactSizeComparison.State.SUCCESS
        assert comparison["diff_items"] is not None
        assert comparison["size_metric_diff"] is not None

    def test_with_explicit_base_id(self):
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

        head_analysis_file = self.create_file(name="head_analysis.json", type="application/json")
        head_size_metric = self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            analysis_file_id=head_analysis_file.id,
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

        comparison_file = self.create_file(name="comparison.json", type="application/json")
        self.create_preprod_artifact_size_comparison(
            head_size_analysis=head_size_metric,
            base_size_analysis=base_size_metric,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=comparison_file.id,
        )

        analysis_data = {
            "analysis_duration": 1.5,
            "download_size": 512000,
            "install_size": 1024000,
            "analysis_version": "1.0.0",
            "treemap": None,
            "insights": None,
            "file_analysis": None,
            "app_components": None,
        }
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

        def get_file_side_effect(id):
            mock_file = MagicMock()
            if id == head_analysis_file.id:
                mock_file.getfile.return_value = BytesIO(json.dumps(analysis_data).encode())
            elif id == comparison_file.id:
                mock_file.getfile.return_value = BytesIO(json.dumps(comparison_data).encode())
            return mock_file

        with (
            patch(
                "sentry.preprod.api.endpoints.public.project_preprod_size_analysis.File"
            ) as MockFile,
            patch("sentry.preprod.api.models.public_api_models.File") as MockModelsFile,
        ):
            MockFile.objects.get.side_effect = get_file_side_effect
            MockFile.DoesNotExist = Exception
            MockModelsFile.objects.get.side_effect = get_file_side_effect
            MockModelsFile.DoesNotExist = Exception

            response = self.client.get(self._get_url() + f"?base_artifact_id={base_artifact.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["base_build_id"] == str(base_artifact.id)
        assert data["comparisons"] is not None

    def test_invalid_base_id(self):
        self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            analysis_file_id=1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1024000,
            max_download_size=512000,
        )

        analysis_data = {
            "analysis_duration": 1.5,
            "download_size": 512000,
            "install_size": 1024000,
            "analysis_version": "1.0.0",
            "treemap": None,
            "insights": None,
            "file_analysis": None,
            "app_components": None,
        }

        with patch(
            "sentry.preprod.api.endpoints.public.project_preprod_size_analysis.File"
        ) as MockFile:
            mock_file_obj = MagicMock()
            mock_fp = BytesIO(json.dumps(analysis_data).encode())
            mock_file_obj.getfile.return_value = mock_fp
            MockFile.objects.get.return_value = mock_file_obj

            response = self.client.get(self._get_url() + "?base_artifact_id=999999")

        assert response.status_code == 404
        assert "base preprod artifact does not exist" in response.json()["detail"]

    def test_base_artifact_different_project(self):
        other_project = self.create_project(organization=self.organization)
        other_file = self.create_file(name="other_artifact.apk", type="application/octet-stream")
        other_artifact = self.create_preprod_artifact(
            project=other_project,
            file_id=other_file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.other.app",
        )

        self.create_preprod_artifact_size_metrics(
            self.preprod_artifact,
            analysis_file_id=1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1024000,
            max_download_size=512000,
        )

        analysis_data = {
            "analysis_duration": 1.5,
            "download_size": 512000,
            "install_size": 1024000,
            "analysis_version": "1.0.0",
            "treemap": None,
            "insights": None,
            "file_analysis": None,
            "app_components": None,
        }

        with patch(
            "sentry.preprod.api.endpoints.public.project_preprod_size_analysis.File"
        ) as MockFile:
            mock_file_obj = MagicMock()
            mock_fp = BytesIO(json.dumps(analysis_data).encode())
            mock_file_obj.getfile.return_value = mock_fp
            MockFile.objects.get.return_value = mock_file_obj

            response = self.client.get(self._get_url() + f"?base_artifact_id={other_artifact.id}")

        assert response.status_code == 404
        assert "base preprod artifact does not exist" in response.json()["detail"]
