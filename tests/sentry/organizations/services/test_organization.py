from django.conf import settings

from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization, OrganizationStatus
from sentry.organizations.services.organization.service import organization_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode_of


@all_silo_test
class CheckOrganizationTest(TestCase):
    def test_check_active_organization_by_slug(self) -> None:
        self.organization = self.create_organization(slug="test")
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=True)
            == self.organization.id
        )
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=False)
            == self.organization.id
        )

    def test_check_missing_organization_by_slug(self) -> None:
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=True) is None
        )
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=False) is None
        )

    def test_check_pending_deletion_organization_by_slug(self) -> None:
        self.organization = self.create_organization(slug="test")
        self.organization.status = OrganizationStatus.PENDING_DELETION
        with assume_test_silo_mode_of(Organization):
            self.organization.save()
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=True) is None
        )
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=False)
            == self.organization.id
        )

    def test_check_active_organization_by_id(self) -> None:
        organization = self.create_organization(slug="test")
        assert (
            organization_service.check_organization_by_id(id=organization.id, only_visible=True)
            is True
        )
        assert (
            organization_service.check_organization_by_id(id=organization.id, only_visible=False)
            is True
        )

    def test_check_missing_organization_by_id(self) -> None:
        assert organization_service.check_organization_by_id(id=1234, only_visible=True) is False
        assert organization_service.check_organization_by_id(id=1234, only_visible=False) is False

    def test_check_pending_deletion_organization_by_id(self) -> None:
        self.organization = self.create_organization(slug="test")
        self.organization.status = OrganizationStatus.PENDING_DELETION
        with assume_test_silo_mode_of(Organization):
            self.organization.save()
        assert (
            organization_service.check_organization_by_id(
                id=self.organization.id, only_visible=True
            )
            is False
        )
        assert (
            organization_service.check_organization_by_id(
                id=self.organization.id, only_visible=False
            )
            is True
        )


@all_silo_test
class FindOrganizationIdByOptionValueTest(TestCase):
    KEY = "stripe_projects:account_id"

    def _set_option(self, organization: Organization, key: str, value: str) -> None:
        with assume_test_silo_mode_of(OrganizationOption):
            OrganizationOption.objects.set_value(organization=organization, key=key, value=value)

    def test_returns_org_id_when_exactly_one_match(self) -> None:
        org = self.create_organization(slug="org-a")
        self._set_option(org, self.KEY, "acct_xyz")

        assert (
            organization_service.find_organization_id_by_option_value(
                cell_name=settings.SENTRY_MONOLITH_REGION,
                key=self.KEY,
                value="acct_xyz",
            )
            == org.id
        )

    def test_returns_none_when_no_rows_match(self) -> None:
        org = self.create_organization(slug="org-a")
        self._set_option(org, self.KEY, "acct_other")

        assert (
            organization_service.find_organization_id_by_option_value(
                cell_name=settings.SENTRY_MONOLITH_REGION,
                key=self.KEY,
                value="acct_missing",
            )
            is None
        )

    def test_returns_lowest_org_id_when_multiple_match(self) -> None:
        # OrganizationOption.unique_together is (organization, key) — two
        # orgs CAN store the same value for the same key. Pin deterministic
        # result = lowest organization_id.
        org_a = self.create_organization(slug="org-a")
        org_b = self.create_organization(slug="org-b")
        self._set_option(org_a, self.KEY, "acct_collide")
        self._set_option(org_b, self.KEY, "acct_collide")

        result = organization_service.find_organization_id_by_option_value(
            cell_name=settings.SENTRY_MONOLITH_REGION,
            key=self.KEY,
            value="acct_collide",
        )
        assert result == min(org_a.id, org_b.id)

    def test_value_match_is_exact_no_case_folding(self) -> None:
        org = self.create_organization(slug="org-a")
        self._set_option(org, self.KEY, "acct_XYZ")

        assert (
            organization_service.find_organization_id_by_option_value(
                cell_name=settings.SENTRY_MONOLITH_REGION,
                key=self.KEY,
                value="acct_xyz",
            )
            is None
        )

    def test_value_match_does_not_strip_whitespace(self) -> None:
        org = self.create_organization(slug="org-a")
        self._set_option(org, self.KEY, "acct_xyz")

        assert (
            organization_service.find_organization_id_by_option_value(
                cell_name=settings.SENTRY_MONOLITH_REGION,
                key=self.KEY,
                value=" acct_xyz ",
            )
            is None
        )

    def test_returns_none_when_key_does_not_match(self) -> None:
        org = self.create_organization(slug="org-a")
        self._set_option(org, "some:other:key", "acct_xyz")

        assert (
            organization_service.find_organization_id_by_option_value(
                cell_name=settings.SENTRY_MONOLITH_REGION,
                key=self.KEY,
                value="acct_xyz",
            )
            is None
        )
