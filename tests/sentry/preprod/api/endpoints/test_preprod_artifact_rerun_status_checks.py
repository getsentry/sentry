from unittest.mock import patch

from sentry.testutils.cases import APITestCase


class PreprodArtifactRerunStatusChecksTest(APITestCase):
    endpoint = "sentry-api-0-preprod-artifact-rerun-status-checks"
    method = "post"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

    def test_success(self):
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
                status_code=202,
            )

            assert response.data["success"] is True
            assert response.data["check_types"] == ["size"]
            mock_task.delay.assert_called_once_with(preprod_artifact_id=artifact.id)

    def test_invalid_check_types(self):
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
            check_types=["invalid"],
            status_code=400,
        )

        assert "No supported check types" in response.data["error"]

    def test_non_string_check_types(self):
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
            check_types=[{"type": "size"}],
            status_code=400,
        )

        assert "All check_types must be strings" in response.data["error"]

    def test_no_commit_comparison(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
        )

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            artifact.id,
            status_code=400,
        )

        assert "no commit comparison" in response.data["error"]

    def test_task_failure(self):
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

    def test_permission_denied(self):
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
