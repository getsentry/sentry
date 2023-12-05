from abc import abstractmethod

from sentry.hybridcloud.rpc_services.control_organization_provisioning import (
    RpcOrganizationSlugReservation,
)
from sentry.services.hybrid_cloud.region import ByRegionName
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.services.organization import OrganizationProvisioningOptions
from sentry.silo import SiloMode


class RegionOrganizationProvisioningRpcService(RpcService):
    """
    RPC Service class containing methods for provisioning an organization that
    has already reserved a global slug in the control silo. This is only
    intended to be used by the `organization_provisioning` RPC service, and
    should not be used by anything else.
    """

    key = "region_organization_provisioning"
    local_mode = SiloMode.REGION

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def create_organization_in_region(
        self,
        region_name: str,
        organization_id: int,
        provision_payload: OrganizationProvisioningOptions,
    ) -> bool:
        """
        CAUTION: THIS IS ONLY INTENDED TO BE USED BY THE `organization_provisioning` RPC SERVICE.
        DO NOT USE FOR LOCAL ORGANIZATION PROVISIONING.

        An RPC method for creating an organization in the desired region.

        :param region_name: The region to create an organization in.
        :param organization_id: The desired organization's ID, which must be a snowflake ID.
        :param provision_payload: The provisioning options for the organization.
        """
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def update_organization_slug_from_reservation(
        self,
        region_name: str,
        org_slug_temporary_alias_res: RpcOrganizationSlugReservation,
    ) -> bool:
        """
        CAUTION: THIS IS ONLY INTENDED TO BE USED BY THE `organization_provisioning` RPC SERVICE.
        DO NOT USE FOR LOCAL CHANGES.

        An RPC method for processing a slug change on the region, after it has been reserved
        as a temporary alias in the control silo.

        :param region_name: The region name where the organization resides.
        :param org_slug_temporary_alias_res: OrganizationSlugReservation for the new temporary alias.
        :return: True if provisioning succeeded, False if a conflict occurred
        """
        pass

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.hybridcloud.rpc_services.region_organization_provisioning.impl import (
            DatabaseBackedRegionOrganizationProvisioningRpcService,
        )

        return DatabaseBackedRegionOrganizationProvisioningRpcService()


region_organization_provisioning_rpc_service = (
    RegionOrganizationProvisioningRpcService.create_delegation()
)
