# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from abc import abstractmethod
from typing import Optional, Set, Tuple

from sentry.hybridcloud.rpc_services.control_organization_provisioning.model import (
    RpcOrganizationSlugReservation,
)
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.services.organization.model import OrganizationProvisioningOptions
from sentry.silo import SiloMode


class ControlOrganizationProvisioningRpcService(RpcService):
    key = "control_org_provisioning"
    local_mode = SiloMode.CONTROL

    @abstractmethod
    @rpc_method
    def provision_organization(
        self, *, region_name: str, org_provision_args: OrganizationProvisioningOptions
    ) -> RpcOrganizationSlugReservation:
        """
        Provisions an organization, an organization member, and team based on the provisioning args passed.

        In the event of a slug conflict, a new slug will be generated using the provided slug as a seed.
        :param region_name: The region to provision the organization in.
        :param org_provision_args: Provisioning and post-provisioning options for the organization.
        :return: RpcOrganizationSlugReservation containing the organization ID and slug.
        """
        pass

    @abstractmethod
    @rpc_method
    def idempotent_provision_organization(
        self, *, region_name: str, org_provision_args: OrganizationProvisioningOptions
    ) -> Optional[RpcOrganizationSlugReservation]:
        """
        Provisions an organization, an organization member, and team based on the provisioning args passed.

        In the event of a slug conflict, the conflicting org will be queried. If the provided owning_user_id
        matches the organization's owning user, the organization will be returned. Otherwise, None will be returned.

        Note: This is not intended to be used for normal organization provisioning; but rather, for use-cases
        such as integrations which require strong idempotency.
        :param region_name: The region to provision the organization in.
        :param org_provision_args: Provisioning and post-provisioning options for the organization.
        :return: RpcOrganization the organization ID and slug.
        """
        pass

    @abstractmethod
    @rpc_method
    def update_organization_slug(
        self,
        *,
        region_name: str,
        organization_id: int,
        desired_slug: str,
        require_exact: bool = True,
    ) -> RpcOrganizationSlugReservation:
        """
        Updates an organization's slug via an outbox based confirmation flow to ensure that the control
        and region silos stay in sync.

        Initially, the organization slug reservation is updated in control silo, which generates a replica
        outbox to the desired region in order to ensure that a slug change in control _will eventually_
        result in a slug change on the region side.

        :param region_name: The region where the organization exists
        :param organization_id: the ID of the organization whose slug to change
        :param desired_slug: The slug to update the organization with
        :param require_exact: Determines whether the slug can be modified with a unique suffix in the
        case of a slug collision.
        :return:
        """
        pass

    @abstractmethod
    @rpc_method
    def bulk_create_organization_slug_reservations(
        self, *, region_name: str, organization_ids_and_slugs: Set[Tuple[int, str]]
    ) -> None:
        """
        Only really intended for bulk organization import usage. Creates unique organization slug
        reservations for the given list of IDs and slug bases for organizations already provisioned
        in the provided region.

        :param region_name: The region where the imported organization exist
        :param organization_ids_and_slugs: A set of ID and base slug tuples to reserve slugs for
        :return:
        """
        pass

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.hybridcloud.rpc_services.control_organization_provisioning.impl import (
            DatabaseBackedControlOrganizationProvisioningService,
        )

        return DatabaseBackedControlOrganizationProvisioningService()


control_organization_provisioning_rpc_service = (
    ControlOrganizationProvisioningRpcService.create_delegation()
)
