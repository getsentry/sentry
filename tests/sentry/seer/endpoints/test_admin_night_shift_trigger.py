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
        assert response.data["max_candidates"] is None
        mock_task.apply_async.assert_called_once_with(
            args=[self.organization.id],
            kwargs={
                "options": {"source": "manual", "dry_run": False},
                "execute_in_task": True,
            },
        )

    def test_trigger_with_max_candidates_override(self) -> None:
        with patch(
            "sentry.seer.endpoints.admin_night_shift_trigger.run_night_shift_for_org"
        ) as mock_task:
            response = self.get_success_response(
                organization_id=self.organization.id,
                max_candidates=3,
                dry_run=True,
                status_code=200,
            )

        assert response.data["max_candidates"] == 3
        mock_task.apply_async.assert_called_once_with(
            args=[self.organization.id],
            kwargs={
                "options": {"source": "manual", "dry_run": True, "max_candidates": 3},
                "execute_in_task": True,
            },
        )

    def test_trigger_rejects_invalid_max_candidates(self) -> None:
        response = self.get_response(
            organization_id=self.organization.id,
            max_candidates="not-a-number",
        )
        assert response.status_code == 400
        assert response.data["detail"] == "max_candidates must be a valid integer"

    def test_trigger_rejects_non_positive_max_candidates(self) -> None:
        for value in (0, -1):
            response = self.get_response(
                organization_id=self.organization.id,
                max_candidates=value,
            )
            assert response.status_code == 400, value
            assert response.data["detail"] == "max_candidates must be >= 1"

    def test_missing_organization_id_triggers_full_schedule(self) -> None:
        with patch(
            "sentry.seer.endpoints.admin_night_shift_trigger.schedule_night_shift"
        ) as mock_schedule:
            response = self.get_success_response(status_code=200)

        assert response.data["success"] is True
        assert response.data["organization_id"] is None
        mock_schedule.apply_async.assert_called_once_with(
            kwargs={"run_options": {"source": "manual", "dry_run": False}},
        )

    def test_full_schedule_forwards_overrides(self) -> None:
        with patch(
            "sentry.seer.endpoints.admin_night_shift_trigger.schedule_night_shift"
        ) as mock_schedule:
            response = self.get_success_response(dry_run=True, max_candidates=5, status_code=200)

        assert response.data["organization_id"] is None
        assert response.data["dry_run"] is True
        assert response.data["max_candidates"] == 5
        mock_schedule.apply_async.assert_called_once_with(
            kwargs={
                "run_options": {"source": "manual", "dry_run": True, "max_candidates": 5},
            },
        )

    def test_invalid_organization_id(self) -> None:
        response = self.get_response(organization_id="not-a-number")
        assert response.status_code == 400
        assert response.data["detail"] == "organization_id must be a valid integer"

    def test_rejects_explicit_null_organization_id(self) -> None:
        # Frontend may serialize NaN to null when a non-numeric value is typed.
        # Treat that as a 400 rather than silently fanning out to every org.
        response = self.get_response(organization_id=None)
        assert response.status_code == 400
        assert response.data["detail"] == "organization_id must be a valid integer"

    def test_rejects_empty_string_organization_id(self) -> None:
        response = self.get_response(organization_id="")
        assert response.status_code == 400
        assert response.data["detail"] == "organization_id must be a valid integer"

    def test_requires_staff(self) -> None:
        non_staff_user = self.create_user(is_staff=False)
        self.login_as(user=non_staff_user)
        response = super().get_response(organization_id=self.organization.id)
        assert response.status_code == 403
