import pytest
from django.db import IntegrityError

from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.organization_mapping import (
    RpcOrganizationMappingUpdate,
    organization_mapping_service,
)
from sentry.testutils import TransactionTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.silo import control_silo_test, exempt_from_silo_limits


@control_silo_test(stable=True)
class OrganizationMappingTest(TransactionTestCase):
    def test_upsert__create_if_not_found(self):
        self.organization = self.create_organization(
            name="test name",
            slug="foobar",
        )

        fixture_org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        fixture_org_mapping.delete()

        assert not OrganizationMapping.objects.filter(organization_id=self.organization.id).exists()

        organization_mapping_service.upsert(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(
                name=self.organization.name,
                slug=self.organization.slug,
                status=self.organization.status,
            ),
        )

        new_org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        assert new_org_mapping.name == self.organization.name
        assert not new_org_mapping.customer_id
        assert new_org_mapping.slug == self.organization.slug
        assert new_org_mapping.status == self.organization.status

    def test_upsert__update_if_found(self):
        with exempt_from_silo_limits():
            self.organization = self.create_organization(
                name="test name",
                slug="foobar",
            )

            self.organization.save()

        fixture_org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)

        organization_mapping_service.upsert(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(
                name="santry_org", slug="santryslug", status=OrganizationStatus.PENDING_DELETION
            ),
        )

        fixture_org_mapping.refresh_from_db()
        assert fixture_org_mapping.name == "santry_org"
        assert fixture_org_mapping.slug == "santryslug"
        assert fixture_org_mapping.status == OrganizationStatus.PENDING_DELETION

    def test_upsert__duplicate_slug(self):
        self.organization = Factories.create_organization(slug="alreadytaken")

        with pytest.raises(IntegrityError):
            organization_mapping_service.upsert(
                organization_id=7654321,
                update=RpcOrganizationMappingUpdate(slug=self.organization.slug),
            )
