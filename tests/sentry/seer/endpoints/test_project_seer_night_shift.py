from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class ProjectSeerNightShiftTest(APITestCase):
    endpoint = "sentry-api-0-project-seer-night-shift"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    @with_feature("organizations:seer-night-shift")
    def test_triggers_task(self) -> None:
        # The endpoint forwards only the manual-trigger metadata; the run
        # options (including project tweaks) are resolved by build_run_options
        # inside the task, scoped to project_ids.
        with patch(
            "sentry.seer.endpoints.project_seer_night_shift.run_night_shift_for_org",
            return_value=42,
        ) as mock_task:
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=200,
            )

        assert response.data == {"run_id": 42}
        mock_task.assert_called_once_with(
            self.organization.id,
            options={"source": "manual", "dry_run": False},
            project_ids=[self.project.id],
            triggering_user_id=self.user.id,
            execute_in_task=True,
        )

    @with_feature("organizations:seer-night-shift")
    def test_triggers_task_with_dry_run(self) -> None:
        with patch(
            "sentry.seer.endpoints.project_seer_night_shift.run_night_shift_for_org",
            return_value=None,
        ) as mock_task:
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                dryRun=True,
                status_code=200,
            )

        assert response.data == {"run_id": None}
        mock_task.assert_called_once_with(
            self.organization.id,
            options={"source": "manual", "dry_run": True},
            project_ids=[self.project.id],
            triggering_user_id=self.user.id,
            execute_in_task=True,
        )

    def test_without_feature_returns_404(self) -> None:
        with patch(
            "sentry.seer.endpoints.project_seer_night_shift.run_night_shift_for_org"
        ) as mock_task:
            response = self.get_response(self.organization.slug, self.project.slug)

        assert response.status_code == 404
        mock_task.assert_not_called()
