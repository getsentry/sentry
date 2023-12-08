from typing import Optional

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
from sentry.services.hybrid_cloud.organization_mapping.serial import (
    update_organization_mapping_from_instance,
)
from sentry.silo import SiloMode
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.silo import (
    assume_test_silo_mode,
    control_silo_test,
    create_test_regions,
    region_silo_test,
)
from sentry.types.region import get_local_region


def assert_matching_organization_mapping(
    org: Organization, customer_id: Optional[str] = None, validate_flags=False
):
    org_mapping = OrganizationMapping.objects.get(organization_id=org.id)
    assert org_mapping.name == org.name
    assert org_mapping.slug == org.slug
    assert org_mapping.status == org.status
    assert org_mapping.region_name
    assert org_mapping.customer_id == customer_id

    if validate_flags:
        assert org_mapping.early_adopter == org.flags.early_adopter
        assert org_mapping.require_2fa == org.flags.require_2fa
        assert org_mapping.allow_joinleave == bool(org.flags.allow_joinleave)
        assert org_mapping.enhanced_privacy == bool(org.flags.enhanced_privacy)
        assert org_mapping.disable_shared_issues == bool(org.flags.disable_shared_issues)
        assert org_mapping.disable_new_visibility_features == bool(
            org.flags.disable_new_visibility_features
        )
        assert org_mapping.require_email_verification == bool(org.flags.require_email_verification)
        assert org_mapping.codecov_access == bool(org.flags.codecov_access)


@control_silo_test(regions=create_test_regions("us"), include_monolith_run=True)
class OrganizationMappingServiceControlProvisioningEnabledTest(TransactionTestCase):
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

        assert_matching_organization_mapping(org=self.organization)

    def test_upsert__reject_duplicate_slug(self):
        self.organization = self.create_organization(slug="alreadytaken", region="us")

        fake_org_id = 7654321
        organization_mapping_service.upsert(
            organization_id=fake_org_id,
            update=RpcOrganizationMappingUpdate(slug=self.organization.slug, region_name="us"),
        )

        assert_matching_organization_mapping(org=self.organization)
        assert not OrganizationMapping.objects.filter(organization_id=fake_org_id).exists()

    def test_upsert__reject_org_slug_reservation_region_mismatch(self):
        self.organization = self.create_organization(slug="santry", region="us")

        organization_mapping_service.upsert(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(
                slug=self.organization.slug, name="saaaaantry", region_name="eu"
            ),
        )

        # Assert that org mapping is rejected
        assert_matching_organization_mapping(org=self.organization)

    def test_upsert__reject_org_slug_reservation_slug_mismatch(self):
        self.organization = self.create_organization(slug="santry", region="us")

        organization_mapping_service.upsert(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(slug="foobar", name="saaaaantry", region_name="us"),
        )

        # Assert that org mapping is rejected
        assert_matching_organization_mapping(org=self.organization)

    def test_upsert__update_when_slug_matches_temporary_alias(self):
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

    def test_upsert__reject_when_no_slug_reservation_found(self):
        self.organization = self.create_organization(slug="santry", region="us")
        with outbox_context(transaction.atomic(router.db_for_write(OrganizationSlugReservation))):
            OrganizationSlugReservation.objects.filter(
                organization_id=self.organization.id
            ).delete()

        organization_mapping_service.upsert(
            organization_id=self.organization.id,
            update=RpcOrganizationMappingUpdate(
                name="santry_org",
                slug="different-slug",
                status=OrganizationStatus.PENDING_DELETION,
                region_name="us",
            ),
        )

        # Organization mapping shouldn't have changed
        assert_matching_organization_mapping(org=self.organization)


@region_silo_test(regions=create_test_regions("us"), include_monolith_run=True)
class OrganizationMappingReplicationTest(TransactionTestCase):
    def test_replicates_all_flags(self):
        self.organization = self.create_organization(slug="santry", region="us")
        self.organization.flags = 255  # all flags set
        organization_mapping_service.upsert(
            organization_id=self.organization.id,
            update=update_organization_mapping_from_instance(
                organization=self.organization, region=get_local_region()
            ),
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert_matching_organization_mapping(self.organization, validate_flags=True)
