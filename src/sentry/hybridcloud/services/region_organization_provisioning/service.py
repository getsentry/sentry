from abc import abstractmethod

from sentry.hybridcloud.rpc.resolvers import ByCellName
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.hybridcloud.services.control_organization_provisioning import (
    RpcOrganizationSlugReservation,
)
from sentry.services.organization import OrganizationProvisioningOptions
from sentry.silo.base import SiloMode


class RegionOrganizationProvisioningRpcService(RpcService):
    """
    RPC Service class containing methods for provisioning an organization that
    has already reserved a global slug in the control silo. This is only
    intended to be used by the `organization_provisioning` RPC service, and
    should not be used by anything else.
    """

    key = "region_organization_provisioning"
    local_mode = SiloMode.REGION

    @regional_rpc_method(resolve=ByCellName())
    @abstractmethod
    def create_organization_in_region(
        self,
        region_name: str,
        organization_id: int,
        provision_payload: OrganizationProvisioningOptions,
    ) -> bool:
        """
        TODO(cells): Deprecated, remove method when all callers are updated to use cell_name create_organization_in_cell
        """

    @regional_rpc_method(resolve=ByCellName())
    @abstractmethod
    def create_organization_in_cell(
        self,
        *,
        cell_name: str,
        organization_id: int,
        provision_payload: OrganizationProvisioningOptions,
    ) -> bool:
        """
        CAUTION: THIS IS ONLY INTENDED TO BE USED BY THE `organization_provisioning` RPC SERVICE.
        DO NOT USE FOR LOCAL ORGANIZATION PROVISIONING.

        An RPC method for creating an organization in the desired cell.

        :param cell_name: The cell to create an organization in.
        :param organization_id: The desired organization's ID, which must be a snowflake ID.
        :param provision_payload: The provisioning options for the organization.
        """

    @regional_rpc_method(resolve=ByCellName())
    @abstractmethod
    def update_organization_slug_from_reservation(
        self,
        *,
        cell_name: str | None = None,  # TODO(cells): make required when all callers are updated
        region_name: str | None = None,  # TODO(cells): remove when all callers are updated
        org_slug_temporary_alias_res: RpcOrganizationSlugReservation,
    ) -> bool:
        """
        CAUTION: THIS IS ONLY INTENDED TO BE USED BY THE `organization_provisioning` RPC SERVICE.
        DO NOT USE FOR LOCAL CHANGES.

        An RPC method for processing a slug change on the region, after it has been reserved
        as a temporary alias in the control silo.

        :param cell_name: The cell where the organization resides.
        :param org_slug_temporary_alias_res: OrganizationSlugReservation for the new temporary alias.
        :return: True if provisioning succeeded, False if a conflict occurred
        """

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.hybridcloud.services.region_organization_provisioning.impl import (
            DatabaseBackedRegionOrganizationProvisioningRpcService,
        )

        return DatabaseBackedRegionOrganizationProvisioningRpcService()


region_organization_provisioning_rpc_service = (
    RegionOrganizationProvisioningRpcService.create_delegation()
)
