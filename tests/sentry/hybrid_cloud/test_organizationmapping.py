import pytest
from django.db import IntegrityError

from sentry.api.serializers import serialize
from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.organization_mapping import organization_mapping_service
from sentry.testutils import TransactionTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class OrganizationMappingTest(TransactionTestCase):
    def test_create(self):
        fields = {
            "user": self.user,
            "organization_id": self.organization.id,
            "slug": self.organization.slug,
            "region_name": "us",
        }
        api_org_mapping = organization_mapping_service.create(**fields)
        org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)

        data = serialize(api_org_mapping, self.user)
        assert data["id"]
        assert data["organizationId"] == str(self.organization.id)
        assert data["verified"] is False
        assert data["slug"] == fields["slug"]
        assert data["regionName"] == fields["region_name"]
        assert data["dateCreated"] == org_mapping.date_created

    def test_idempotency_key(self):
        data = {
            "slug": self.organization.slug,
            "region_name": "us",
            "idempotency_key": "test",
        }
        self.create_organization_mapping(self.organization, **data)
        next_organization_id = 7654321
        api_org_mapping = organization_mapping_service.create(
            **{
                **data,
                "user": self.user,
                "organization_id": next_organization_id,
                "region_name": "de",
            }
        )

        assert not OrganizationMapping.objects.filter(organization_id=self.organization.id).exists()
        assert OrganizationMapping.objects.filter(organization_id=next_organization_id)

        data = serialize(api_org_mapping, self.user)
        assert data["id"]
        assert data["organizationId"] == str(next_organization_id)
        assert data["regionName"] == "de"

    def test_duplicate_slug(self):
        data = {
            "slug": self.organization.slug,
            "region_name": "us",
            "idempotency_key": "test",
        }
        self.create_organization_mapping(self.organization, **data)

        with pytest.raises(IntegrityError):
            organization_mapping_service.create(
                **{
                    **data,
                    "user": self.user,
                    "organization_id": 7654321,
                    "region_name": "de",
                    "idempotency_key": "test2",
                }
            )

    def test_update_customer_id(self):
        fields = {
            "user": self.user,
            "organization_id": self.organization.id,
            "slug": self.organization.slug,
            "region_name": "us",
        }
        api_org_mapping = organization_mapping_service.create(**fields)
        assert api_org_mapping.customer_id is None

        assert (
            organization_mapping_service.update_customer_id(
                organization_id=self.organization.id, customer_id="test"
            )
            == 1
        )
        org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        assert org_mapping.customer_id == "test"
