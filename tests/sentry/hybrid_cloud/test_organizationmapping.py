import time

import pytest
from django.db import IntegrityError

from sentry.models import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.organization_mapping import (
    ApiOrganizationMappingUpdate,
    organization_mapping_service,
)
from sentry.testutils import TransactionTestCase
from sentry.testutils.silo import control_silo_test, exempt_from_silo_limits


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

        assert api_org_mapping.organization_id == self.organization.id
        assert api_org_mapping.verified is False
        assert api_org_mapping.slug == fields["slug"]
        assert api_org_mapping.region_name == fields["region_name"]
        assert api_org_mapping.date_created == org_mapping.date_created

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

        assert api_org_mapping.organization_id == next_organization_id
        assert api_org_mapping.region_name == "de"

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

    def test_update(self):
        fields = {
            "user": self.user,
            "organization_id": self.organization.id,
            "slug": self.organization.slug,
            "region_name": "us",
        }
        api_org_mapping = organization_mapping_service.create(**fields)
        assert api_org_mapping.customer_id is None

        organization_mapping_service.update(
            ApiOrganizationMappingUpdate(
                organization_id=self.organization.id,
                customer_id="test",
            )
        )
        org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        assert org_mapping.customer_id == "test"

        organization_mapping_service.update(
            ApiOrganizationMappingUpdate(organization_id=self.organization.id, name="new name!")
        )
        org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        assert org_mapping.customer_id == "test"
        assert org_mapping.name == "new name!"

        organization_mapping_service.update(
            ApiOrganizationMappingUpdate(organization_id=self.organization.id)
        )
        # Does not overwrite with empty value.
        assert org_mapping.name == "new name!"

    def test_create_org_with_name(self):
        # snowflake id generation isn't great.  We need this to prevent flaky tests.
        time.sleep(1)

        # This is much how a hybrid cloud org creation + slug reservation would work.
        # Notice that org objects are not created before, rather after org slug reservation.
        org_id = Organization.reserve_snowflake_id()
        user = self.create_user()

        organization_mapping_service.create(
            user=user,
            organization_id=org_id,
            slug="my-cool-slug",
            region_name="the-region",
            idempotency_key="abc",
            customer_id=None,
        )

        # Two slug leases is representative of a common case.
        mapping = organization_mapping_service.create(
            user=user,
            organization_id=org_id,
            slug="my-cool-slug-2",
            region_name="the-region",
            idempotency_key="abc",
            customer_id=None,
        )

        assert mapping.organization_id == org_id

        org = self.create_organization(
            id=mapping.organization_id, slug="", name="the-org-name", owner=user
        )
        # Trigger update
        org.slug = mapping.slug
        with exempt_from_silo_limits():
            org.save()

        assert org.id == mapping.organization_id

        with exempt_from_silo_limits():
            outbox = Organization.outbox_for_update(org.id)
            outbox.save()
            outbox.drain_shard()
            # org_summary = organization_service.get_organizations(
            #     organization_ids=[org.id],
            #     only_visible=False,
            #     scope=None, user_id=None)[0]
            om = OrganizationMapping.objects.filter(organization_id=mapping.organization_id).last()

        assert om.name == "the-org-name"
