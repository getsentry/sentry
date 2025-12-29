from unittest.mock import patch

from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import APITestCase


class PreprodArtifactRerunStatusChecksTest(APITestCase):
    endpoint = "sentry-api-0-preprod-artifact-rerun-status-checks"
    method = "post"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

    def test_rerun_status_checks_success_default(self):
        """Test successful status check rerun with default check_types"""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            provider="github",
            head_repo_name="sentry/sentry",
            head_sha="abc123",
        )
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            commit_comparison=commit_comparison,
        )

        with patch(
            "sentry.preprod.api.endpoints.preprod_artifact_rerun_status_checks.create_preprod_status_check_task"
        ) as mock_task:
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                artifact.id,
                status_code=202,
            )

            assert response.data["success"] is True
            assert response.data["artifact_id"] == str(artifact.id)
            assert response.data["check_types"] == ["size"]
            assert "Status check rerun initiated" in response.data["message"]
            mock_task.delay.assert_called_once_with(preprod_artifact_id=artifact.id)

    def test_rerun_status_checks_with_explicit_check_types(self):
        """Test status check rerun with explicit check_types array"""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            provider="github",
            head_repo_name="sentry/sentry",
            head_sha="abc123",
        )
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            commit_comparison=commit_comparison,
        )

        with patch(
            "sentry.preprod.api.endpoints.preprod_artifact_rerun_status_checks.create_preprod_status_check_task"
        ) as mock_task:
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                artifact.id,
                check_types=["size"],
                status_code=202,
            )

            assert response.data["check_types"] == ["size"]
            mock_task.delay.assert_called_once_with(preprod_artifact_id=artifact.id)

    def test_rerun_status_checks_not_an_array(self):
        """Test error when check_types is not an array"""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            provider="github",
            head_repo_name="sentry/sentry",
            head_sha="abc123",
        )
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            commit_comparison=commit_comparison,
        )

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            artifact.id,
            check_types="size",
            status_code=400,
        )

        assert "check_types must be an array" in response.data["error"]

    def test_rerun_status_checks_empty_array(self):
        """Test error when check_types is empty array"""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            provider="github",
            head_repo_name="sentry/sentry",
            head_sha="abc123",
        )
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            commit_comparison=commit_comparison,
        )

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            artifact.id,
            check_types=[],
            status_code=400,
        )

        assert "check_types must contain at least one check type" in response.data["error"]

    def test_rerun_status_checks_invalid_check_types(self):
        """Test error when invalid check_types provided"""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            provider="github",
            head_repo_name="sentry/sentry",
            head_sha="abc123",
        )
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            commit_comparison=commit_comparison,
        )

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            artifact.id,
            check_types=["invalid", "another_invalid"],
            status_code=400,
        )

        assert "Invalid check_types" in response.data["error"]
        assert "only 'size' is currently supported" in response.data["error"].lower()

    def test_rerun_status_checks_no_commit_comparison(self):
        """Test error when artifact has no commit comparison"""
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            artifact.id,
            status_code=400,
        )

        assert "no commit comparison" in response.data["error"]

    def test_rerun_status_checks_artifact_not_found(self):
        """Test error when artifact doesn't exist"""
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            999999,
            status_code=404,
        )

        assert response.status_code == 404

    def test_rerun_status_checks_wrong_project(self):
        """Test error when artifact belongs to different project"""
        other_project = self.create_project(organization=self.organization)
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            provider="github",
            head_repo_name="sentry/sentry",
            head_sha="abc123",
        )
        artifact = self.create_preprod_artifact(
            project=other_project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            commit_comparison=commit_comparison,
        )

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            artifact.id,
            status_code=404,
        )

        assert response.status_code == 404

    def test_rerun_status_checks_task_failure(self):
        """Test error handling when task queueing fails"""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            provider="github",
            head_repo_name="sentry/sentry",
            head_sha="abc123",
        )
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            commit_comparison=commit_comparison,
        )

        with patch(
            "sentry.preprod.api.endpoints.preprod_artifact_rerun_status_checks.create_preprod_status_check_task"
        ) as mock_task:
            mock_task.delay.side_effect = Exception("Task queue error")

            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                artifact.id,
                status_code=500,
            )

            assert "Failed to queue status checks" in response.data["error"]
            assert response.data["failed_check_types"] == ["size"]

    def test_rerun_status_checks_permission_denied(self):
        """Test permission denied for user without access"""
        other_user = self.create_user()
        self.login_as(user=other_user)

        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            provider="github",
            head_repo_name="sentry/sentry",
            head_sha="abc123",
        )
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            commit_comparison=commit_comparison,
        )

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            artifact.id,
            status_code=403,
        )

        assert response.status_code == 403

    def test_rerun_status_checks_allows_any_state(self):
        """Test that status checks can be rerun in any artifact state"""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            provider="github",
            head_repo_name="sentry/sentry",
            head_sha="abc123",
        )

        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.FAILED,
            commit_comparison=commit_comparison,
        )

        with patch(
            "sentry.preprod.api.endpoints.preprod_artifact_rerun_status_checks.create_preprod_status_check_task"
        ):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                artifact.id,
                status_code=202,
            )

            assert response.data["success"] is True

        artifact.state = PreprodArtifact.ArtifactState.UPLOADED
        artifact.save()

        with patch(
            "sentry.preprod.api.endpoints.preprod_artifact_rerun_status_checks.create_preprod_status_check_task"
        ):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                artifact.id,
                status_code=202,
            )

            assert response.data["success"] is True
