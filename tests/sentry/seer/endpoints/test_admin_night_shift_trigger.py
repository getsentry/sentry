from unittest.mock import patch

from sentry.testutils.cases import APITestCase


class SeerAdminNightShiftTriggerTest(APITestCase):
    endpoint = "sentry-admin-seer-night-shift-trigger"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(is_staff=True)
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def get_response(self, *args, **params):
        with patch("sentry.api.permissions.is_active_staff", return_value=True):
            return super().get_response(*args, **params)

    def test_trigger_night_shift(self) -> None:
        with patch(
            "sentry.seer.endpoints.admin_night_shift_trigger.run_night_shift_for_org"
        ) as mock_task:
            response = self.get_success_response(
                organization_id=self.organization.id,
                status_code=200,
            )

        assert response.data["success"] is True
        assert response.data["organization_id"] == self.organization.id
        mock_task.apply_async.assert_called_once_with(args=[self.organization.id])

    def test_missing_organization_id(self) -> None:
        response = self.get_response()
        assert response.status_code == 400
        assert response.data["detail"] == "organization_id is required"

    def test_invalid_organization_id(self) -> None:
        response = self.get_response(organization_id="not-a-number")
        assert response.status_code == 400
        assert response.data["detail"] == "organization_id must be a valid integer"

    def test_requires_staff(self) -> None:
        non_staff_user = self.create_user(is_staff=False)
        self.login_as(user=non_staff_user)
        response = super().get_response(organization_id=self.organization.id)
        assert response.status_code == 403
