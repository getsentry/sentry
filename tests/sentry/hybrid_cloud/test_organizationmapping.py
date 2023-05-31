import pytest
from django.db import IntegrityError

from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.organization_mapping import (
    RpcOrganizationMappingUpdate,
    organization_mapping_service,
)
from sentry.testutils import TransactionTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.silo import control_silo_test


@pytest.mark.skip(reason="Disabling these tests until we finalize the organization mapping logic")
@control_silo_test(stable=True)
class OrganizationMappingTest(TransactionTestCase):
    def test_create(self):
        self.organization = Factories.create_organization(no_mapping=True)
        fields = {
            "organization_id": self.organization.id,
            "slug": self.organization.slug,
            "name": "test name",
            "region_name": "us",
        }
        rpc_org_mapping = organization_mapping_service.create(**fields)
        org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        assert org_mapping.idempotency_key == ""
        assert (
            rpc_org_mapping.organization_id == org_mapping.organization_id == self.organization.id
        )
        assert rpc_org_mapping.verified is org_mapping.verified is False
        assert rpc_org_mapping.slug == org_mapping.slug == fields["slug"]
        assert rpc_org_mapping.region_name == org_mapping.region_name == fields["region_name"]
        assert rpc_org_mapping.date_created == org_mapping.date_created
        assert rpc_org_mapping.name == org_mapping.name == fields["name"]

    def test_idempotency_key(self):
        self.organization = Factories.create_organization(no_mapping=True)
        data = {
            "slug": self.organization.slug,
            "name": "test name",
            "region_name": "us",
            "idempotency_key": "test",
        }
        self.create_organization_mapping(self.organization, **data)
        next_organization_id = 7654321
        rpc_org_mapping = organization_mapping_service.create(
            **{**data, "organization_id": next_organization_id}
        )

        assert not OrganizationMapping.objects.filter(organization_id=self.organization.id).exists()
        org_mapping = OrganizationMapping.objects.filter(organization_id=next_organization_id)
        assert org_mapping
        org_mapping = org_mapping.first()
        assert org_mapping.idempotency_key == data["idempotency_key"]

        assert rpc_org_mapping.organization_id == next_organization_id
        assert rpc_org_mapping.region_name == "us"
        assert rpc_org_mapping.name == data["name"]

    def test_duplicate_slug(self):
        self.organization = Factories.create_organization(no_mapping=True)
        data = {
            "slug": self.organization.slug,
            "name": "test name",
            "region_name": "us",
            "idempotency_key": "test",
        }
        self.create_organization_mapping(self.organization, **data)

        with pytest.raises(IntegrityError):
            organization_mapping_service.create(
                **{
                    **data,
                    "organization_id": 7654321,
                    "region_name": "de",
                    "idempotency_key": "test2",
                }
            )

    def test_update(self):
        self.organization = Factories.create_organization(no_mapping=True)
        fields = {
            "name": "test name",
            "organization_id": self.organization.id,
            "slug": self.organization.slug,
            "region_name": "us",
        }
        rpc_org_mapping = organization_mapping_service.create(**fields)
        assert rpc_org_mapping.customer_id is None

        organization_mapping_service.update(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(customer_id="test"),
        )
        org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        assert org_mapping.customer_id == "test"

        organization_mapping_service.update(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(name="new name!"),
        )
        org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        assert org_mapping.customer_id == "test"
        assert org_mapping.name == "new name!"

        organization_mapping_service.update(
            organization_id=self.organization.id, update=RpcOrganizationMappingUpdate()
        )
        # Does not overwrite with empty value.
        assert org_mapping.name == "new name!"
