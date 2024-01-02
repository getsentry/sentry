from sentry.models.organization import Organization, OrganizationStatus
from sentry.services.hybrid_cloud.organization.service import organization_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode_of


@all_silo_test
class CheckOrganizationTest(TestCase):
    def test_check_active_organization_by_slug(self):
        self.organization = self.create_organization(slug="test")
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=True)
            == self.organization.id
        )
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=False)
            == self.organization.id
        )

    def test_check_missing_organization_by_slug(self):
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=True) is None
        )
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=False) is None
        )

    def test_check_pending_deletion_organization_by_slug(self):
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

    def test_check_active_organization_by_id(self):
        organization = self.create_organization(slug="test")
        assert (
            organization_service.check_organization_by_id(id=organization.id, only_visible=True)
            is True
        )
        assert (
            organization_service.check_organization_by_id(id=organization.id, only_visible=False)
            is True
        )

    def test_check_missing_organization_by_id(self):
        assert organization_service.check_organization_by_id(id=1234, only_visible=True) is False
        assert organization_service.check_organization_by_id(id=1234, only_visible=False) is False

    def test_check_pending_deletion_organization_by_id(self):
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
