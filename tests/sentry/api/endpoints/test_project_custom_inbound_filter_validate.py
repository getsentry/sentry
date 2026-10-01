from unittest.mock import MagicMock, patch

from sentry.api.endpoints.project_custom_inbound_filters import (
    MAX_CONDITION_VALUE_CHARS_PER_FILTER,
)
from sentry.seer.models import SeerApiError
from sentry.testutils.cases import APITestCase

SEER_PATH = "sentry.api.endpoints.project_custom_inbound_filter_validate.run_oneshot"


class CustomInboundFilterValidateTest(APITestCase):
    endpoint = "sentry-api-0-project-custom-inbound-filter-validate"
    method = "post"
    features = [
        "organizations:inbound-filters-v2",
        "projects:custom-inbound-filters",
        "organizations:inbound-filters-name-suggestion",
    ]

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.login_as(user=self.user)

    @patch(SEER_PATH, return_value={"name": "Flaky connection errors"})
    def test_valid_definition_gets_a_name(self, mock_request: MagicMock) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                dataType="error",
                conditions=[
                    {"type": "error_message", "value": ["*ConnectionReset*", "*ETIMEDOUT*"]},
                    {"type": "release", "value": ["3.*"]},
                ],
            )

        assert response.data == {"errors": {}, "suggestedName": "Flaky connection errors"}
        mock_request.assert_called_once_with(
            "inbound_filter_name",
            {
                "data_type": "error",
                "conditions": [
                    {"type": "error_message", "value": ["*ConnectionReset*", "*ETIMEDOUT*"]},
                    {"type": "release", "value": ["3.*"]},
                ],
            },
            self.organization,
            user_id=self.user.id,
            timeout=10,
        )

    @patch(SEER_PATH, return_value={"name": "  Padded name  "})
    def test_name_is_stripped(self, mock_request: MagicMock) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                dataType="error",
                conditions=[{"type": "error_message", "value": ["*"]}],
            )

        assert response.data["suggestedName"] == "Padded name"

    @patch(SEER_PATH)
    def test_invalid_definition_reports_errors_and_skips_seer(
        self, mock_request: MagicMock
    ) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                dataType="span",
                conditions=[{"type": "error_message", "value": ["*"]}],
            )

        assert response.data["suggestedName"] is None
        assert str(response.data["errors"]["conditions"][0]) == (
            "A filter on span data cannot use the error_message condition. "
            "It accepts release, ip_address."
        )
        mock_request.assert_not_called()

    @patch(SEER_PATH)
    def test_condition_errors_keep_the_save_shape(self, mock_request: MagicMock) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                dataType="error",
                conditions=[
                    {"type": "error_message", "value": ["*"]},
                    {"type": "ip_address", "value": ["not-an-address"]},
                ],
            )

        assert response.data["suggestedName"] is None
        assert response.data["errors"]["conditions"][0] == {}
        assert str(response.data["errors"]["conditions"][1]["value"][0]) == (
            "not-an-address is not an IP address or CIDR range."
        )
        mock_request.assert_not_called()

    @patch(SEER_PATH)
    def test_without_name_suggestion_feature_still_validates(self, mock_request: MagicMock) -> None:
        with self.feature(["organizations:inbound-filters-v2", "projects:custom-inbound-filters"]):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                dataType="error",
                conditions=[{"type": "error_message", "value": ["*"]}],
            )

        assert response.data == {"errors": {}, "suggestedName": None}
        mock_request.assert_not_called()

    @patch(SEER_PATH)
    def test_hidden_ai_features_skip_seer(self, mock_request: MagicMock) -> None:
        self.organization.update_option("sentry:hide_ai_features", True)

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                dataType="error",
                conditions=[{"type": "error_message", "value": ["*"]}],
            )

        assert response.data == {"errors": {}, "suggestedName": None}
        mock_request.assert_not_called()

    @patch(SEER_PATH, side_effect=SeerApiError("Seer request failed", 500))
    def test_seer_failure_leaves_the_name_empty(self, mock_request: MagicMock) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                dataType="error",
                conditions=[{"type": "error_message", "value": ["*"]}],
            )

        assert response.data == {"errors": {}, "suggestedName": None}

    @patch(SEER_PATH, return_value={})
    def test_missing_answer_leaves_the_name_empty(self, mock_request: MagicMock) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                dataType="error",
                conditions=[{"type": "error_message", "value": ["*"]}],
            )

        assert response.data == {"errors": {}, "suggestedName": None}

    @patch(SEER_PATH, return_value={"name": "Legacy release errors"})
    def test_edit_of_an_oversized_filter_is_checked_against_the_stored_one(
        self, mock_request: MagicMock
    ) -> None:
        stored_size = MAX_CONDITION_VALUE_CHARS_PER_FILTER + 10
        custom_filter = self.create_project_custom_inbound_filter(
            project=self.project,
            data_type="error",
            conditions=[{"type": "release", "value": ["a" * stored_size]}],
        )
        same_size = [{"type": "release", "value": ["b" * stored_size]}]

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                dataType="error",
                conditions=same_size,
            )
        assert "conditions" in response.data["errors"]

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                id=str(custom_filter.id),
                dataType="error",
                conditions=same_size,
            )
        assert response.data == {"errors": {}, "suggestedName": "Legacy release errors"}

    def test_unknown_filter_id(self) -> None:
        with self.feature(self.features):
            self.get_error_response(
                self.organization.slug,
                self.project.slug,
                id="999999",
                dataType="error",
                conditions=[{"type": "error_message", "value": ["*"]}],
                status_code=404,
            )

    def test_without_inbound_filters_v2_feature(self) -> None:
        with self.feature("projects:custom-inbound-filters"):
            self.get_error_response(
                self.organization.slug,
                self.project.slug,
                dataType="error",
                conditions=[{"type": "error_message", "value": ["*"]}],
                status_code=404,
            )

    def test_without_custom_inbound_filters_plan_feature(self) -> None:
        with self.feature("organizations:inbound-filters-v2"):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                dataType="error",
                conditions=[{"type": "error_message", "value": ["*"]}],
                status_code=400,
            )

        assert response.data == {"detail": "You do not have that feature enabled"}

    def test_requires_project_write(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(user=member)

        with self.feature(self.features):
            self.get_error_response(
                self.organization.slug,
                self.project.slug,
                dataType="error",
                conditions=[{"type": "error_message", "value": ["*"]}],
                status_code=403,
            )
