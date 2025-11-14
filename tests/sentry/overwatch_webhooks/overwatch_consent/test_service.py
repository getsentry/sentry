from typing import int
from sentry.models.options import OrganizationOption
from sentry.models.organization import Organization
from sentry.overwatch_webhooks.overwatch_consent.model import RpcOrganizationConsentStatus
from sentry.overwatch_webhooks.overwatch_consent.service import overwatch_consent_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode_of, create_test_regions


@all_silo_test(regions=create_test_regions("us"))
class OverwatchConsentServiceTest(TestCase):
    def _add_organization_options(self, org: Organization, options: dict[str, bool]):
        with assume_test_silo_mode_of(OrganizationOption):
            for key, value in options.items():
                OrganizationOption.objects.set_value(org, key, value)

    def test_get_organization_consent_status_delegation(self):
        org = self.create_organization()

        result = overwatch_consent_service.get_organization_consent_status(
            organization_ids=[org.id], region_name="us"
        )

        assert isinstance(result, dict)
        assert org.id in result
        assert isinstance(result[org.id], RpcOrganizationConsentStatus)
        assert result[org.id].organization_id == org.id
        assert isinstance(result[org.id].has_consent, bool)

    def test_get_organization_consent_status_multiple_orgs(self):
        org1 = self.create_organization()
        org2 = self.create_organization()

        self._add_organization_options(
            org1,
            {"sentry:hide_ai_features": False, "sentry:enable_pr_review_test_generation": True},
        )
        self._add_organization_options(
            org2, {"sentry:hide_ai_features": True, "sentry:enable_pr_review_test_generation": True}
        )

        result = overwatch_consent_service.get_organization_consent_status(
            organization_ids=[org1.id, org2.id], region_name="us"
        )

        assert len(result) == 2
        assert org1.id in result
        assert org2.id in result
        assert result[org1.id].organization_id == org1.id
        assert result[org1.id].has_consent is True
        assert result[org2.id].organization_id == org2.id
        assert result[org2.id].has_consent is False

    def test_get_organization_consent_status_empty_list(self):
        result = overwatch_consent_service.get_organization_consent_status(
            organization_ids=[], region_name="us"
        )

        assert result == {}

    def test_get_organization_consent_status_nonexistent_org(self):
        nonexistent_id = 999999

        result = overwatch_consent_service.get_organization_consent_status(
            organization_ids=[nonexistent_id], region_name="us"
        )

        assert result == {}

    def test_get_organization_consent_status_mixed_existing_nonexistent(self):
        org = self.create_organization()
        self._add_organization_options(
            org, {"sentry:hide_ai_features": False, "sentry:enable_pr_review_test_generation": True}
        )

        nonexistent_id = 999999

        result = overwatch_consent_service.get_organization_consent_status(
            organization_ids=[org.id, nonexistent_id], region_name="us"
        )

        assert len(result) == 1
        assert org.id in result
        assert nonexistent_id not in result
        assert result[org.id].organization_id == org.id
        assert result[org.id].has_consent is True
