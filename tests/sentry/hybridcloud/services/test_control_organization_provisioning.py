from __future__ import annotations

import pytest
from django.db import IntegrityError, router, transaction
from django.db.models import QuerySet

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.hybridcloud.rpc.service import RpcRemoteException
from sentry.hybridcloud.services.control_organization_provisioning import (
    RpcOrganizationSlugReservation,
    control_organization_provisioning_rpc_service,
)
from sentry.hybridcloud.services.control_organization_provisioning.impl import (
    InvalidOrganizationProvisioningException,
)
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationslugreservation import (
    OrganizationSlugReservation,
    OrganizationSlugReservationType,
)
from sentry.services.organization import (
    OrganizationOptions,
    OrganizationProvisioningOptions,
    PostProvisionOptions,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, create_test_regions
from sentry.types.region import get_local_region


class TestControlOrganizationProvisioningBase(TestCase):
    def setUp(self) -> None:
        self.provision_user = self.create_user()
        self.provisioning_args = self.generate_provisioning_args(
            name="sentry", slug="sentry", user_id=self.provision_user.id, default_team=True
        )

        self.region_name = (
            "us" if SiloMode.get_current_mode() == SiloMode.CONTROL else get_local_region().name
        )

    def generate_provisioning_args(
        self,
        *,
        name: str,
        slug: str,
        default_team: bool,
        user_id: int | None = None,
        email: str | None = None,
    ) -> OrganizationProvisioningOptions:
        return OrganizationProvisioningOptions(
            provision_options=OrganizationOptions(
                name=name,
                slug=slug,
                owning_user_id=user_id,
                owning_email=email,
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

    def get_slug_reservations_for_organization(
        self, organization_id: int
    ) -> QuerySet[OrganizationSlugReservation]:
        with assume_test_silo_mode(SiloMode.CONTROL):
            return OrganizationSlugReservation.objects.filter(organization_id=organization_id)

    def assert_slug_reservation_and_org_exist(
        self, rpc_org_slug: RpcOrganizationSlugReservation, user_id: int | None = None
    ) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_slug_reservation = OrganizationSlugReservation.objects.get(
                organization_id=rpc_org_slug.organization_id
            )

        with assume_test_silo_mode(SiloMode.REGION):
            organization = Organization.objects.get(id=rpc_org_slug.organization_id)
            owner_id = organization.default_owner_id
            owner = OrganizationMember.objects.get(organization=organization)
            assert owner.role == "owner"

        assert org_slug_reservation.organization_id == organization.id
        assert rpc_org_slug.slug == org_slug_reservation.slug == organization.slug
        assert owner_id == user_id

    def assert_organization_has_not_changed(self, old_organization: Organization) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            new_organization = Organization.objects.get(id=old_organization.id)

        assert old_organization == new_organization


@all_silo_test(regions=create_test_regions("us"))
class TestControlOrganizationProvisioning(TestControlOrganizationProvisioningBase):
    def test_organization_provisioning_happy_path(self) -> None:
        rpc_org_slug = self.provision_organization()
        self.assert_slug_reservation_and_org_exist(
            rpc_org_slug=rpc_org_slug, user_id=self.provision_user.id
        )

    def test_organization_provisioning_before_user_provisioning(self) -> None:
        provisioning_options = self.generate_provisioning_args(
            name="sentry", slug="sentry", email="test-owner@sentry.io", default_team=True
        )
        slug = control_organization_provisioning_rpc_service.provision_organization(
            region_name="us", org_provision_args=provisioning_options
        )
        self.assert_slug_reservation_and_org_exist(
            rpc_org_slug=slug,
        )

    def test_organization_already_provisioned_for_different_user(self) -> None:
        user = self.create_user()
        conflicting_slug = self.provisioning_args.provision_options.slug

        with assume_test_silo_mode(SiloMode.REGION):
            owner_of_conflicting_org = self.create_user()
            region_only_organization = self.create_organization(
                name="conflicting_org", slug=conflicting_slug, owner=owner_of_conflicting_org
            )

        # De-register the conflicting organization to create the collision
        with (
            assume_test_silo_mode(SiloMode.CONTROL),
            outbox_context(
                transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
            ),
        ):
            OrganizationSlugReservation.objects.filter(
                organization_id=region_only_organization.id
            ).delete()

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

    def test_generates_unique_slugs_when_conflicted(self) -> None:
        previous_org_slug_reservation = self.provision_organization()
        new_org_slug_reservation = self.provision_organization()

        assert new_org_slug_reservation != previous_org_slug_reservation
        assert self.provisioning_args.provision_options.slug in new_org_slug_reservation.slug
        assert new_org_slug_reservation.slug != self.provisioning_args.provision_options.slug

    def test_rewrites_numeric_slug_if_prevent_numeric_option_enabled(self) -> None:
        numeric_slug = "123456"
        self.provisioning_args.provision_options.slug = numeric_slug
        org_slug_reservation = self.provision_organization()
        assert org_slug_reservation.slug != numeric_slug
        self.assert_slug_reservation_and_org_exist(
            rpc_org_slug=org_slug_reservation, user_id=self.provision_user.id
        )


@all_silo_test(regions=create_test_regions("us"))
class TestControlOrganizationProvisioningSlugUpdates(TestControlOrganizationProvisioningBase):
    def test_updates_exact_slug(self) -> None:
        org_slug_res = self.provision_organization()
        updated_org_slug_res = (
            control_organization_provisioning_rpc_service.update_organization_slug(
                organization_id=org_slug_res.organization_id,
                desired_slug="newsantry",
                require_exact=True,
                region_name=self.region_name,
            )
        )

        assert updated_org_slug_res.slug == "newsantry"
        self.assert_slug_reservation_and_org_exist(
            rpc_org_slug=updated_org_slug_res, user_id=self.provision_user.id
        )

    def test_updates_inexact_slug_without_collision(self) -> None:
        org_slug_res = self.provision_organization()
        updated_org_slug_res = (
            control_organization_provisioning_rpc_service.update_organization_slug(
                organization_id=org_slug_res.organization_id,
                desired_slug="newsantry",
                require_exact=False,
                region_name=self.region_name,
            )
        )

        assert updated_org_slug_res.slug == "newsantry"
        self.assert_slug_reservation_and_org_exist(
            rpc_org_slug=updated_org_slug_res, user_id=self.provision_user.id
        )

    def test_updates_inexact_slug_with_collision(self) -> None:
        test_org_slug_reservation = self.provision_organization()

        new_user = self.create_user()
        conflicting_slug = "foobar"
        self.provisioning_args.provision_options.owning_user_id = new_user.id
        self.provisioning_args.provision_options.slug = conflicting_slug
        org_slug_res_with_conflict = self.provision_organization()

        self.assert_slug_reservation_and_org_exist(
            rpc_org_slug=org_slug_res_with_conflict, user_id=new_user.id
        )

        updated_org_slug_res = (
            control_organization_provisioning_rpc_service.update_organization_slug(
                organization_id=test_org_slug_reservation.organization_id,
                desired_slug=conflicting_slug,
                require_exact=False,
                region_name=self.region_name,
            )
        )

        assert conflicting_slug in updated_org_slug_res.slug
        assert updated_org_slug_res.slug != conflicting_slug

        self.assert_slug_reservation_and_org_exist(
            rpc_org_slug=updated_org_slug_res, user_id=self.provision_user.id
        )

        # Validate that the conflict org still matches its org slug reservation
        self.assert_slug_reservation_and_org_exist(
            rpc_org_slug=org_slug_res_with_conflict, user_id=new_user.id
        )

    def test_fails_to_update_exact_slug_with_collision(self) -> None:
        test_org_slug_reservation = self.provision_organization()
        original_slug = test_org_slug_reservation.slug

        new_user = self.create_user()
        conflicting_slug = "foobar"
        self.provisioning_args.provision_options.owning_user_id = new_user.id
        self.provisioning_args.provision_options.slug = conflicting_slug
        org_with_conflicting_slug = self.provision_organization()

        if SiloMode.get_current_mode() == SiloMode.REGION:
            with pytest.raises(RpcRemoteException):
                control_organization_provisioning_rpc_service.update_organization_slug(
                    organization_id=test_org_slug_reservation.organization_id,
                    desired_slug=conflicting_slug,
                    require_exact=True,
                    region_name=self.region_name,
                )
        else:
            with pytest.raises(IntegrityError):
                control_organization_provisioning_rpc_service.update_organization_slug(
                    organization_id=test_org_slug_reservation.organization_id,
                    desired_slug=conflicting_slug,
                    require_exact=True,
                    region_name=self.region_name,
                )

        with assume_test_silo_mode(SiloMode.CONTROL):
            org_slug_reservation = OrganizationSlugReservation.objects.get(
                id=test_org_slug_reservation.id
            )
        assert org_slug_reservation.slug == original_slug
        self.assert_slug_reservation_and_org_exist(
            rpc_org_slug=org_with_conflicting_slug, user_id=new_user.id
        )

    def test_conflicting_unregistered_organization_with_slug_exists(self) -> None:
        test_org_slug_reservation = self.provision_organization()
        original_slug = test_org_slug_reservation.slug
        conflicting_slug = "foobar"

        new_user = self.create_user()
        unregistered_org = self.create_organization(slug=conflicting_slug, owner=new_user)

        with (
            assume_test_silo_mode(SiloMode.CONTROL),
            outbox_context(
                transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
            ),
        ):
            OrganizationSlugReservation.objects.filter(organization_id=unregistered_org.id).delete()
            assert not OrganizationSlugReservation.objects.filter(slug=conflicting_slug).exists()

        if SiloMode.get_current_mode() == SiloMode.REGION:
            with pytest.raises(RpcRemoteException):
                control_organization_provisioning_rpc_service.update_organization_slug(
                    organization_id=test_org_slug_reservation.organization_id,
                    desired_slug=conflicting_slug,
                    require_exact=True,
                    region_name=self.region_name,
                )
        else:
            with pytest.raises(InvalidOrganizationProvisioningException):
                control_organization_provisioning_rpc_service.update_organization_slug(
                    organization_id=test_org_slug_reservation.organization_id,
                    desired_slug=conflicting_slug,
                    require_exact=True,
                    region_name=self.region_name,
                )

        slug_reservations = self.get_slug_reservations_for_organization(
            organization_id=test_org_slug_reservation.organization_id
        )

        assert (
            len(slug_reservations) == 1
        ), f"Expected only a single slug reservation, received: {slug_reservations}"
        assert slug_reservations[0].slug == original_slug
        assert slug_reservations[0].reservation_type == OrganizationSlugReservationType.PRIMARY

    def test_swap_for_org_without_primary_slug(self) -> None:
        desired_primary_slug = "foobar"

        new_user = self.create_user()
        unregistered_org = self.create_organization(slug=desired_primary_slug, owner=new_user)

        with (
            assume_test_silo_mode(SiloMode.CONTROL),
            outbox_context(
                transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
            ),
        ):
            OrganizationSlugReservation.objects.filter(organization_id=unregistered_org.id).delete()
            assert not OrganizationSlugReservation.objects.filter(
                slug=desired_primary_slug
            ).exists()

        control_organization_provisioning_rpc_service.update_organization_slug(
            organization_id=unregistered_org.id,
            desired_slug=desired_primary_slug,
            require_exact=True,
            region_name=self.region_name,
        )

        slug_reservations = self.get_slug_reservations_for_organization(
            organization_id=unregistered_org.id
        )

        assert (
            len(slug_reservations) == 1
        ), f"Expected only a single slug reservation, received: {slug_reservations}"
        assert slug_reservations[0].slug == desired_primary_slug
        assert slug_reservations[0].reservation_type == OrganizationSlugReservationType.PRIMARY

    def test_swap_with_same_slug(self) -> None:
        desired_slug = "santry"
        org = self.create_organization(slug=desired_slug, owner=self.create_user())
        control_organization_provisioning_rpc_service.update_organization_slug(
            organization_id=org.id,
            desired_slug=desired_slug,
            require_exact=True,
            region_name=self.region_name,
        )

        slug_reservations = self.get_slug_reservations_for_organization(organization_id=org.id)

        assert (
            len(slug_reservations) == 1
        ), f"Expected only a single slug reservation, received: {slug_reservations}"
        assert slug_reservations[0].slug == desired_slug
        assert slug_reservations[0].reservation_type == OrganizationSlugReservationType.PRIMARY

        with assume_test_silo_mode(SiloMode.REGION):
            org.refresh_from_db()
            assert org.slug == desired_slug
