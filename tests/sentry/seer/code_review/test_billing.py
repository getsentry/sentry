from unittest.mock import MagicMock, patch

from sentry.constants import DataCategory
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.seer.code_review.billing import passes_code_review_billing_check
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


class TestPassesCodeReviewBillingCheck(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.organization,
                provider="github",
                external_id="github:123",
            )
        self.external_identifier = "user123"

    def test_billing_check_fails_when_contributor_does_not_exist(self) -> None:
        with patch("sentry.seer.code_review.billing.metrics.incr") as mock_incr:
            result = passes_code_review_billing_check(
                organization_id=self.organization.id,
                integration_id=self.integration.id,
                external_identifier="nonexistent-user",
            )

        assert result is False
        mock_incr.assert_called_once_with(
            "overwatch.code_review.contributor_not_found",
            tags={"organization_id": self.organization.id},
        )

    @patch("sentry.seer.code_review.billing.quotas.backend.check_seer_quota")
    def test_billing_check_fails_when_quota_check_returns_false(
        self, mock_check_quota: MagicMock
    ) -> None:
        mock_check_quota.return_value = False

        contributor = OrganizationContributors.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier=self.external_identifier,
        )

        result = passes_code_review_billing_check(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier=self.external_identifier,
        )

        assert result is False
        mock_check_quota.assert_called_once_with(
            org_id=self.organization.id,
            data_category=DataCategory.SEER_USER,
            seat_object=contributor,
        )

    @patch("sentry.seer.code_review.billing.quotas.backend.check_seer_quota")
    def test_billing_check_succeeds_when_contributor_exists_and_quota_available(
        self, mock_check_quota: MagicMock
    ) -> None:
        mock_check_quota.return_value = True

        contributor = OrganizationContributors.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier=self.external_identifier,
        )

        result = passes_code_review_billing_check(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier=self.external_identifier,
        )

        assert result is True
        mock_check_quota.assert_called_once_with(
            org_id=self.organization.id,
            data_category=DataCategory.SEER_USER,
            seat_object=contributor,
        )
