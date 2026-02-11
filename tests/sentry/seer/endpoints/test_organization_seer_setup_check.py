from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry.testutils.cases import APITestCase, SnubaTestCase


class OrganizationSeerSetupCheckTestBase(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-seer-setup-check"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def get_response(self, organization_slug, **kwargs):
        url = f"/api/0/organizations/{organization_slug}/seer/setup-check/"
        return self.client.get(url, format="json", **kwargs)


class OrganizationSeerSetupCheckSuccessTest(OrganizationSeerSetupCheckTestBase):
    def test_successful_setup_default_state(self) -> None:
        """
        Test the default state with no acknowledgements and quotas available.
        """
        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "setupAcknowledgement": {
                "orgHasAcknowledged": True,
                "userHasAcknowledged": True,
            },
            "billing": {
                "hasAutofixQuota": True,
                "hasScannerQuota": True,
            },
        }

    @patch("sentry.quotas.backend.check_seer_quota")
    def test_no_autofix_quota(self, mock_has_budget: MagicMock) -> None:
        """
        Test when the organization has no autofix quota available.
        """

        def side_effect(org_id, data_category):
            from sentry.constants import DataCategory

            if data_category == DataCategory.SEER_AUTOFIX:
                return False
            return True  # Scanner quota available

        mock_has_budget.side_effect = side_effect

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data["billing"] == {
            "hasAutofixQuota": False,
            "hasScannerQuota": True,
        }

    @patch("sentry.quotas.backend.check_seer_quota")
    def test_no_scanner_quota(self, mock_has_budget: MagicMock) -> None:
        """
        Test when the organization has no scanner quota available.
        """

        def side_effect(org_id, data_category):
            from sentry.constants import DataCategory

            if data_category == DataCategory.SEER_SCANNER:
                return False
            return True  # Autofix quota available

        mock_has_budget.side_effect = side_effect

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data["billing"] == {
            "hasAutofixQuota": True,
            "hasScannerQuota": False,
        }

    @patch("sentry.quotas.backend.check_seer_quota")
    def test_no_quotas_available(self, mock_has_budget: MagicMock) -> None:
        """
        Test when the organization has no quotas available for either service.
        """
        mock_has_budget.return_value = False

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data["billing"] == {
            "hasAutofixQuota": False,
            "hasScannerQuota": False,
        }
