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
        with patch(
            "sentry.seer.endpoints.project_seer_night_shift.run_night_shift_for_project"
        ) as mock_task:
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=202,
            )

        mock_task.apply_async.assert_called_once_with(args=[self.project.id])

    def test_without_feature_returns_404(self) -> None:
        with patch(
            "sentry.seer.endpoints.project_seer_night_shift.run_night_shift_for_project"
        ) as mock_task:
            response = self.get_response(self.organization.slug, self.project.slug)

        assert response.status_code == 404
        mock_task.apply_async.assert_not_called()
