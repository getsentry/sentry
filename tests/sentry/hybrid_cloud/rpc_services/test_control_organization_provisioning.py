from __future__ import annotations

import pytest

from sentry.hybridcloud.rpc_services.organization_provisioning import (
    RpcOrganizationSlugReservation,
    control_organization_provisioning_rpc_service,
)
from sentry.models import Organization, OrganizationSlugReservation
from sentry.services.hybrid_cloud.rpc import RpcRemoteException
from sentry.services.organization import (
    OrganizationOptions,
    OrganizationProvisioningOptions,
    PostProvisionOptions,
)
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


@all_silo_test(stable=True)
class TestControlOrganizationProvisioning(TestCase):
    def setUp(self):
        self.provision_user = self.create_user()
        self.provisioning_args = self.generate_provisioning_args(
            name="sentry", slug="sentry", user_id=self.provision_user.id, default_team=True
        )

    def generate_provisioning_args(
        self, *, name: str, slug: str, user_id: int, default_team: bool
    ) -> OrganizationProvisioningOptions:
        return OrganizationProvisioningOptions(
            provision_options=OrganizationOptions(
                name=name,
                slug=slug,
                owning_user_id=user_id,
                create_default_team=default_team,
                is_test=False,
            ),
            post_provision_options=PostProvisionOptions(),
        )

    def provision_organization(self) -> RpcOrganizationSlugReservation:
        slug_reservation = control_organization_provisioning_rpc_service.provision_organization(
            region_name="us", org_provision_args=self.provisioning_args
        )
        return slug_reservation

    def assert_slug_reservation_and_org_exist(
        self, rpc_org_slug: RpcOrganizationSlugReservation, user_id
    ):
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_slug_reservation = OrganizationSlugReservation.objects.get(
                organization_id=rpc_org_slug.organization_id
            )

        with assume_test_silo_mode(SiloMode.REGION):
            organization = Organization.objects.get(id=rpc_org_slug.organization_id)
            owner_id = organization.default_owner_id

        assert org_slug_reservation.organization_id == organization.id
        assert rpc_org_slug.slug == org_slug_reservation.slug == organization.slug
        assert owner_id == user_id

    def assert_organization_has_not_changed(self, old_organization: Organization):
        with assume_test_silo_mode(SiloMode.REGION):
            new_organization = Organization.objects.get(id=old_organization.id)

        # TODO(Gabe): Validate that this equality is sufficient
        assert old_organization == new_organization

    def test_organization_provisioning_happy_path(self):
        rpc_org_slug = self.provision_organization()
        self.assert_slug_reservation_and_org_exist(
            rpc_org_slug=rpc_org_slug, user_id=self.provision_user.id
        )

    def test_organization_region_inconsistency(self):
        user = self.create_user()
        conflicting_slug = self.provisioning_args.provision_options.slug

        with assume_test_silo_mode(SiloMode.REGION):
            region_only_organization = Organization.objects.create(
                name="conflicting_org",
                slug=conflicting_slug,
            )

        if SiloMode.get_current_mode() == SiloMode.REGION:
            with pytest.raises(RpcRemoteException):
                self.provision_organization()
        else:
            with pytest.raises(OrganizationSlugReservation.DoesNotExist):
                self.provision_organization()

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not OrganizationSlugReservation.objects.filter(slug=conflicting_slug).exists()
            assert not OrganizationSlugReservation.objects.filter(user_id=user.id).exists()

        self.assert_organization_has_not_changed(region_only_organization)
        # TODO(Gabe): Add testing for slug replica status during this failure case
        #  and ensure that no replica exists for the slug post-deletion

    def test_generates_unique_slugs_when_conflicted(self):
        previous_org_slug_reservation = self.provision_organization()
        new_org_slug_reservation = self.provision_organization()

        assert new_org_slug_reservation != previous_org_slug_reservation
        assert self.provisioning_args.provision_options.slug in new_org_slug_reservation.slug
        assert new_org_slug_reservation.slug != self.provisioning_args.provision_options.slug

    @override_options({"api.prevent-numeric-slugs": True})
    def test_rewrites_numeric_slug_if_prevent_numeric_option_enabled(self):
        numeric_slug = "123456"
        self.provisioning_args.provision_options.slug = numeric_slug
        org_slug_reservation = self.provision_organization()
        assert org_slug_reservation.slug != numeric_slug
        self.assert_slug_reservation_and_org_exist(
            rpc_org_slug=org_slug_reservation, user_id=self.provision_user.id
        )
