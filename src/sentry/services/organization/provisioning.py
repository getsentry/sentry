from typing import Any, Optional

from django.conf import settings
from django.db import IntegrityError, router, transaction
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
from sentry.services.organization.model import OrganizationProvisioningOptions


class OrganizationSlugCollisionException(Exception):
    pass


class OrganizationProvisioningException(Exception):
    pass


class OrganizationProvisioningService:
    def provision_organization_in_region(
        self, provisioning_options: OrganizationProvisioningOptions, region_name: Optional[str]
    ):
        """
        Provisions an organization in the provided region. If no region is
        provided, the default monolith region is assumed.

        This method is fairly slim at the moment, solely because it's acting
        as a proxy for the underlying RPC service. There will be more
        provisioning logic added when this is made multi-region safe.

        :param provisioning_options: The organization provisioning and post-
        provisioning options
        :param region_name: The region name to provision the organization in.
        :return: RPCOrganization
        """
        if region_name is None:
            region_name = settings.SENTRY_MONOLITH_REGION

        from sentry.services.hybrid_cloud.organization_provisioning import (
            organization_provisioning_service as rpc_org_provisioning_service,
        )

        rpc_org = rpc_org_provisioning_service.provision_organization(
            region_name=region_name, org_provision_args=provisioning_options
        )

        return rpc_org

    def idempotent_provision_organization_in_region(
        self, provisioning_options: OrganizationProvisioningOptions, region_name: Optional[str]
    ):
        raise NotImplementedError()

    def modify_organization_slug(self, organization_id: int, slug: str):
        """
        Updates an organization with the given slug if available.

         This is currently database backed, but will be switched to be
         RPC based in the near future.
        :param organization_id:
        :param slug:
        :return:
        """

        from sentry.models import Organization

        try:
            with transaction.atomic(using=router.db_for_write(Organization)):
                organization = Organization.objects.get(id=organization_id)
                organization.slug = slug
                organization.save()
        except IntegrityError:
            raise OrganizationSlugCollisionException()


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
