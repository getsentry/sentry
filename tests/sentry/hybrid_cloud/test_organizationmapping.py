from typing import Optional

import pytest
from django.db import router, transaction

from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationslugreservation import (
    OrganizationSlugReservation,
    OrganizationSlugReservationType,
)
from sentry.models.outbox import outbox_context
from sentry.services.hybrid_cloud.organization_mapping import (
    RpcOrganizationMappingUpdate,
    organization_mapping_service,
)
from sentry.services.hybrid_cloud.organization_mapping.impl import (
    OrganizationMappingConsistencyException,
)
from sentry.silo import SiloMode
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test(stable=True)
class OrganizationMappingTest(TransactionTestCase):
    def assert_matching_organization_mapping(
        self, org: Organization, customer_id: Optional[str] = None
    ):
        org_mapping = OrganizationMapping.objects.get(organization_id=org.id)
        assert org_mapping.name == org.name
        assert org_mapping.slug == org.slug
        assert org_mapping.status == org.status
        assert org_mapping.region_name
        assert org_mapping.customer_id == customer_id

    def test_upsert__create_if_not_found(self):
        self.organization = self.create_organization(name="test name", slug="foobar", region="us")

        fixture_org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        fixture_org_mapping.delete()

        assert not OrganizationMapping.objects.filter(organization_id=self.organization.id).exists()

        organization_mapping_service.upsert(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(
                name=self.organization.name,
                slug=self.organization.slug,
                status=self.organization.status,
                region_name="us",
            ),
        )

        self.assert_matching_organization_mapping(org=self.organization)

    def test_upsert__update_if_found(self):
        with assume_test_silo_mode(SiloMode.REGION):
            self.organization = self.create_organization(
                name="test name", slug="santryslug", region="us"
            )

        fixture_org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)

        organization_mapping_service.upsert(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(
                name="santry_org",
                slug="santryslug",
                status=OrganizationStatus.PENDING_DELETION,
                region_name="us",
            ),
        )

        fixture_org_mapping.refresh_from_db()
        assert fixture_org_mapping.name == "santry_org"
        assert fixture_org_mapping.slug == "santryslug"
        assert fixture_org_mapping.status == OrganizationStatus.PENDING_DELETION

    def test_upsert__duplicate_slug(self):
        self.organization = self.create_organization(slug="alreadytaken", region="us")
        assert OrganizationMapping.objects.get(organization_id=self.organization.id)

        fake_org_id = 7654321
        organization_mapping_service.upsert(
            organization_id=fake_org_id,
            update=RpcOrganizationMappingUpdate(slug=self.organization.slug, region_name="us"),
        )

        assert not OrganizationMapping.objects.filter(organization_id=fake_org_id).exists()

    def test_org_slug_reservation_region_mismatch(self):
        self.organization = self.create_organization(slug="santry", region="us")

        with pytest.raises(OrganizationMappingConsistencyException):
            organization_mapping_service.upsert(
                organization_id=self.organization.id,
                update=RpcOrganizationMappingUpdate(
                    slug=self.organization.slug, name="saaaaantry", region_name="eu"
                ),
            )

    def test_org_slug_reservation_slug_mismatch(self):
        self.organization = self.create_organization(slug="santry", region="us")

        with pytest.raises(OrganizationMappingConsistencyException):
            organization_mapping_service.upsert(
                organization_id=self.organization.id,
                update=RpcOrganizationMappingUpdate(
                    slug="foobar", name="saaaaantry", region_name="us"
                ),
            )

    def test_update_when_slug_matches_temporary_alias(self):
        user = self.create_user()
        self.organization = self.create_organization(slug="santry", region="us", owner=user)
        primary_slug_res = OrganizationSlugReservation.objects.get(
            organization_id=self.organization.id
        )

        temporary_slug = "foobar"
        with outbox_context(transaction.atomic(router.db_for_write(OrganizationSlugReservation))):
            OrganizationSlugReservation(
                slug=temporary_slug,
                organization_id=self.organization.id,
                reservation_type=OrganizationSlugReservationType.TEMPORARY_RENAME_ALIAS,
                region_name=primary_slug_res.region_name,
                user_id=user.id,
            ).save(unsafe_write=True)

        organization_mapping_service.upsert(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(
                slug=temporary_slug, name="saaaaantry", region_name="us"
            ),
        )

    def test_update_without_slug(self):
        self.organization = self.create_organization(slug="santry", region="us")

        organization_mapping_service.upsert(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(
                slug=self.organization.slug,
                name=self.organization.name,
                status=self.organization.status,
                region_name="us",
                customer_id=("abc123",),
            ),
        )

        new_org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        assert new_org_mapping.name == self.organization.name
        assert new_org_mapping.slug == self.organization.slug
        assert new_org_mapping.status == self.organization.status
        assert new_org_mapping.customer_id == "abc123"

    def test_update_when_no_slug_reservation_found(self):
        self.organization = self.create_organization(slug="santry", region="us")
        with outbox_context(transaction.atomic(router.db_for_write(OrganizationSlugReservation))):
            OrganizationSlugReservation.objects.filter(
                organization_id=self.organization.id
            ).delete()

        organization_mapping_service.upsert(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(
                name="santry_org",
                slug="santry",
                status=OrganizationStatus.PENDING_DELETION,
                region_name="us",
            ),
        )

        new_org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        assert new_org_mapping.name == self.organization.name
        assert new_org_mapping.slug == self.organization.slug
        assert new_org_mapping.status == self.organization.status
