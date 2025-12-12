from __future__ import annotations

import calendar
from unittest.mock import MagicMock, patch

import orjson
from django.utils import timezone

from sentry.models.promptsactivity import PromptsActivity
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
                "orgHasAcknowledged": False,
                "userHasAcknowledged": False,
            },
            "billing": {
                "hasAutofixQuota": True,
                "hasScannerQuota": True,
            },
        }

    def test_current_user_acknowledged_setup(self) -> None:
        """
        Test when the current user has acknowledged the setup.
        """
        feature = "seer_autofix_setup_acknowledged"
        PromptsActivity.objects.create(
            user_id=self.user.id,
            feature=feature,
            organization_id=self.organization.id,
            project_id=0,
            data=orjson.dumps(
                {"dismissed_ts": calendar.timegm(timezone.now().utctimetuple())}
            ).decode("utf-8"),
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data["setupAcknowledgement"] == {
            "orgHasAcknowledged": True,
            "userHasAcknowledged": True,
        }

    def test_org_acknowledged_not_user(self) -> None:
        """
        Test when another user in the org has acknowledged, but not the requesting user.
        """
        other_user = self.create_user()
        self.create_member(user=other_user, organization=self.organization, role="member")
        feature = "seer_autofix_setup_acknowledged"
        PromptsActivity.objects.create(
            user_id=other_user.id,
            feature=feature,
            organization_id=self.organization.id,
            project_id=0,
            data=orjson.dumps(
                {"dismissed_ts": calendar.timegm(timezone.now().utctimetuple())}
            ).decode("utf-8"),
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data["setupAcknowledgement"] == {
            "orgHasAcknowledged": True,
            "userHasAcknowledged": False,
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
