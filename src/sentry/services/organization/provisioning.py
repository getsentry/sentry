from typing import Any, Optional, Set, Tuple

from django.db import router, transaction
from django.dispatch import receiver
from pydantic import ValidationError
from sentry_sdk import capture_exception

from sentry.hybridcloud.rpc_services.region_organization_provisioning import (
    region_organization_provisioning_rpc_service,
)
from sentry.models.organizationslugreservation import (
    OrganizationSlugReservation,
    OrganizationSlugReservationType,
)
from sentry.models.outbox import OutboxCategory, outbox_context, process_control_outbox
from sentry.services.hybrid_cloud.organization import RpcOrganization, organization_service
from sentry.services.organization.model import OrganizationProvisioningOptions
from sentry.silo import SiloMode
from sentry.types.region import get_local_region


class OrganizationSlugCollisionException(Exception):
    pass


class OrganizationProvisioningException(Exception):
    pass


class OrganizationProvisioningService:
    def _validate_or_default_region(self, region_name: Optional[str]):
        silo_mode = SiloMode.get_current_mode()
        if region_name is None and silo_mode == SiloMode.CONTROL:
            raise OrganizationProvisioningException(
                "A region name must be provided when provisioning an organization from the Control Silo"
            )
        elif silo_mode != SiloMode.CONTROL:
            local_region = get_local_region()

            assert (
                not region_name or region_name == local_region.name
            ), "Cannot provision an organization in another region"

            region_name = local_region.name

        return region_name

    def _control_based_provisioning(
        self,
        provisioning_options: OrganizationProvisioningOptions,
        region_name: str,
    ) -> RpcOrganization:
        from sentry.hybridcloud.rpc_services.control_organization_provisioning import (
            RpcOrganizationSlugReservation,
            control_organization_provisioning_rpc_service,
        )

        rpc_org_slug_reservation: RpcOrganizationSlugReservation = (
            control_organization_provisioning_rpc_service.provision_organization(
                region_name=region_name, org_provision_args=provisioning_options
            )
        )

        rpc_org = organization_service.get(id=rpc_org_slug_reservation.organization_id)

        if rpc_org is None:
            raise OrganizationProvisioningException("Provisioned organization was not found")

        return rpc_org

    def provision_organization_in_region(
        self,
        provisioning_options: OrganizationProvisioningOptions,
        region_name: Optional[str] = None,
    ) -> RpcOrganization:
        """
        Creates a new Organization in the destination region. If called from a
        region silo without a region_name, the local region name will be used.

        :param provisioning_options: A provisioning payload containing all the necessary
        data to fully provision an organization within the region.

        :param region_name: The region to provision the organization in
        :return: RpcOrganization of the newly created org
        """

        destination_region_name = self._validate_or_default_region(region_name=region_name)
        return self._control_based_provisioning(
            provisioning_options=provisioning_options, region_name=destination_region_name
        )

    def idempotent_provision_organization_in_region(
        self, provisioning_options: OrganizationProvisioningOptions, region_name: Optional[str]
    ) -> RpcOrganization:
        raise NotImplementedError()

    def _control_based_slug_change(
        self, organization_id: int, slug: str, region_name: Optional[str] = None
    ):
        destination_region_name = self._validate_or_default_region(region_name=region_name)

        from sentry.hybridcloud.rpc_services.control_organization_provisioning import (
            RpcOrganizationSlugReservation,
            control_organization_provisioning_rpc_service,
        )

        rpc_slug_reservation: RpcOrganizationSlugReservation = (
            control_organization_provisioning_rpc_service.update_organization_slug(
                organization_id=organization_id,
                desired_slug=slug,
                require_exact=True,
                region_name=destination_region_name,
            )
        )

        rpc_org = organization_service.get(id=rpc_slug_reservation.organization_id)

        if rpc_org is None:
            raise OrganizationProvisioningException(
                "Organization not found despite slug change succeeding"
            )

    def change_organization_slug(
        self, organization_id: int, slug: str, region_name: Optional[str] = None
    ) -> RpcOrganization:
        """
        Updates an organization with the given slug if available.

         This is currently database backed, but will be switched to be
         RPC based in the near future.
        :param organization_id: the ID of the organization whose slug to change
        :param slug: The desired slug for the organization
        :param region_name: The region where the organization is located
        :return:
        """

        return self._control_based_slug_change(
            organization_id=organization_id, slug=slug, region_name=region_name
        )

    def bulk_create_organization_slugs(
        self, org_ids_and_slugs: Set[Tuple[int, str]], region_name: Optional[str] = None
    ):
        """
        CAUTION: DO NOT USE THIS OUTSIDE OF THE IMPORT/RELOCATION CONTEXT

        Organizations are meant to be provisioned via the
         `provision_organization_in_region` method, which handles both slug
         reservation and organization creation.

        Bulk creates slug reservations for imported organizations that already
        exist on the region. Each target organization is provided as a tuple of
        Organization ID (int) and base slug (str).

        :param org_ids_and_slugs: A set of tuples containing an organization ID
        and base slug.
        :param region_name: The region where the imported organizations exist
        :return:
        """
        destination_region_name = self._validate_or_default_region(region_name=region_name)

        from sentry.hybridcloud.rpc_services.control_organization_provisioning import (
            control_organization_provisioning_rpc_service,
        )

        control_organization_provisioning_rpc_service.bulk_create_organization_slug_reservations(
            organization_ids_and_slugs=org_ids_and_slugs, region_name=destination_region_name
        )


organization_provisioning_service = OrganizationProvisioningService()


def handle_organization_provisioning_outbox_payload(
    *,
    organization_id: int,
    region_name: str,
    provisioning_payload: OrganizationProvisioningOptions,
):
    """
    CAUTION: THIS IS ONLY INTENDED TO BE USED BY THE `organization_provisioning` RPC SERVICE.
    DO NOT USE THIS FOR LOCAL PROVISIONING.

    Method for handling a provisioning payload
    :param organization_id: The desired ID for the organization
    :param region_name: The region to provision the organization in
    :param provisioning_payload: The organization data used to provision the org
    :return:
    """

    org_slug_reservation_qs = OrganizationSlugReservation.objects.filter(
        organization_id=organization_id, slug=provisioning_payload.provision_options.slug
    )

    slug_res_count = org_slug_reservation_qs.count()
    if slug_res_count != 1:
        capture_exception(
            OrganizationProvisioningException(
                f"Expected there to be a single slug reservation, {slug_res_count} were found"
            )
        )
        return

    org_slug_reservation = org_slug_reservation_qs.first()

    able_to_provision = region_organization_provisioning_rpc_service.create_organization_in_region(
        organization_id=organization_id,
        provision_payload=provisioning_payload,
        region_name=region_name,
    )

    if not able_to_provision:
        # If the region returns false when validating provisioning information,
        # it's likely a conflict has occurred (e.g. an org create locally).
        # This means we need to delete the old org slug reservation as it
        # can no longer be assumed to be valid.
        with outbox_context(transaction.atomic(router.db_for_write(OrganizationSlugReservation))):
            org_slug_reservation.delete()
        return


@receiver(process_control_outbox, sender=OutboxCategory.PROVISION_ORGANIZATION)
def process_provision_organization_outbox(
    object_identifier: int, region_name: str, payload: Any, **kwds: Any
):
    try:
        provision_payload = OrganizationProvisioningOptions.parse_obj(payload)
    except ValidationError as e:
        # The provisioning payload is likely malformed and cannot be processed.
        capture_exception(e)
        return

    handle_organization_provisioning_outbox_payload(
        organization_id=object_identifier,
        region_name=region_name,
        provisioning_payload=provision_payload,
    )


def handle_possible_organization_slug_swap(*, region_name: str, org_slug_reservation_id: int):
    """
    CAUTION: THIS IS ONLY INTENDED TO BE USED BY THE `organization_provisioning` RPC SERVICE.
    DO NOT USE THIS FOR LOCAL SLUG SWAPS.

    :param region_name: The region where the organization is located
    :param org_slug_reservation_id: the id of the organization slug reservation ID being updated
    :return:
    """

    org_slug_reservation_qs = OrganizationSlugReservation.objects.filter(
        id=org_slug_reservation_id,
        reservation_type=OrganizationSlugReservationType.TEMPORARY_RENAME_ALIAS,
    )

    # Only process temporary aliases for slug swaps
    if not org_slug_reservation_qs.exists():
        return

    org_slug_reservation = org_slug_reservation_qs.first()

    from sentry.hybridcloud.rpc_services.control_organization_provisioning import (
        serialize_slug_reservation,
    )

    able_to_update_slug = (
        region_organization_provisioning_rpc_service.update_organization_slug_from_reservation(
            region_name=region_name,
            org_slug_temporary_alias_res=serialize_slug_reservation(
                slug_reservation=org_slug_reservation
            ),
        )
    )

    with outbox_context(transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))):
        # Even if we aren't able to update the slug on the region,
        # we roll back the temporary alias as it's either be completed, or no longer valid
        org_slug_reservation.delete()

        if able_to_update_slug:
            primary_slug_reservation_qs = OrganizationSlugReservation.objects.filter(
                organization_id=org_slug_reservation.organization_id,
                reservation_type=OrganizationSlugReservationType.PRIMARY.value,
            )

            if primary_slug_reservation_qs.exists():
                primary_slug_reservation = primary_slug_reservation_qs.get()
                primary_slug_reservation.slug = org_slug_reservation.slug
                primary_slug_reservation.save(unsafe_write=True)
            else:
                # If the organization is missing a primary slug reservation, we want to write one
                OrganizationSlugReservation(
                    slug=org_slug_reservation.slug,
                    organization_id=org_slug_reservation.organization_id,
                    reservation_type=OrganizationSlugReservationType.PRIMARY,
                    user_id=org_slug_reservation.user_id,
                    region_name=region_name,
                ).save(unsafe_write=True)


@receiver(process_control_outbox, sender=OutboxCategory.ORGANIZATION_SLUG_RESERVATION_UPDATE)
def update_organization_slug_reservation(object_identifier: int, region_name: str, **kwds: Any):
    handle_possible_organization_slug_swap(
        region_name=region_name,
        org_slug_reservation_id=object_identifier,
    )
